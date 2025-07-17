import { logger } from '@php-wasm/logger';
import {
	type StreamedPHPResponse,
	type UniversalPHP,
} from '@php-wasm/universal';
import { phpVar } from '@php-wasm/util';
import type { BlueprintDeclaration } from '@wp-playground/blueprints';

export type PHPExceptionDetails = {
	exception: string;
	message: string;
	file: string;
	line: number;
	trace: string;
};

export type BlueprintMessage =
	| { type: 'blueprint.target_resolved' }
	| { type: 'blueprint.progress'; progress: number; caption: string }
	| {
			type: 'blueprint.error';
			message: string;
			details?: PHPExceptionDetails;
	  }
	| { type: 'blueprint.completion'; message: string };

interface RunV2Options {
	php: UniversalPHP;
	cliArgs?: string[];
	blueprint: BlueprintV2Declaration | ParsedBlueprintV2Declaration;
	blueprintOverrides?: {
		wordpressVersion?: string;
		additionalSteps?: any[];
	};
	onMessage?: (message: BlueprintMessage) => void | Promise<void>;
}

export type BlueprintV2Declaration = string | BlueprintDeclaration | undefined;
export type ParsedBlueprintV2Declaration =
	| { type: 'inline-file'; contents: string }
	| { type: 'file-reference'; reference: string };

export function parseBlueprintDeclaration(
	source: BlueprintV2Declaration | ParsedBlueprintV2Declaration
): ParsedBlueprintV2Declaration {
	if (
		typeof source === 'object' &&
		'type' in source &&
		['inline-file', 'file-reference'].includes(source.type)
	) {
		return source;
	}
	if (!source) {
		return {
			type: 'inline-file',
			contents: '{}',
		};
	}
	if (typeof source !== 'string') {
		// If source is an object, assume it's a Blueprint declaration object and
		// convert it to a JSON string.
		return {
			type: 'inline-file',
			contents: JSON.stringify(source),
		};
	}
	try {
		// If source is valid JSON, return it as is.
		JSON.parse(source);
		return {
			type: 'inline-file',
			contents: source,
		};
	} catch {
		return {
			type: 'file-reference',
			reference: source,
		};
	}
}

export async function getV2Runner(): Promise<File> {
	let data = null;

	/**
	 * Avoid a static dependency for now.
	 *
	 * Playground.wordpress.net does not need to know about the new runner yet, and
	 * a static import would force it to download the v2 runner even when it's not needed.
	 * This breaks the offline mode as the static assets list is not yet updated to accommodate
	 * for the new .phar file.
	 */
	// @ts-ignore
	const v2_runner_url = (await import('../public/blueprints.phar?url'))
		.default;

	/**
	 * Only load the v2 runner via node:fs when running in Node.js.
	 */
	if (typeof process !== 'undefined' && process.versions?.node) {
		let path = v2_runner_url;
		if (path.startsWith('/@fs/')) {
			path = path.slice('/@fs'.length);
		}
		if (path.startsWith('file://')) {
			path = path.slice('file://'.length);
		}

		const { readFile } = await import('node:fs/promises');
		data = await readFile(path);
	} else {
		const response = await fetch(v2_runner_url);
		data = await response.blob();
	}
	return new File([data], `blueprints.phar`, {
		type: 'application/zip',
	});
}

export async function runBlueprintV2(
	options: RunV2Options
): Promise<StreamedPHPResponse> {
	const cliArgs = options.cliArgs || [];
	for (const arg of cliArgs) {
		if (arg.startsWith('--site-path=')) {
			throw new Error(
				'The --site-path CLI argument must not be provided. In Playground, it is always set to /wordpress.'
			);
		}
	}
	cliArgs.push('--site-path=/wordpress');

	/**
	 * Divergence from blueprints.phar – the default database engine is
	 * SQLite. Why? Because in Playground we'll use SQLite far more often than
	 * MySQL.
	 */
	const dbEngine = cliArgs.find((arg) => arg.startsWith('--db-engine='));
	if (!dbEngine) {
		cliArgs.push('--db-engine=sqlite');
	}

	const php = options.php;
	const onMessage = options?.onMessage || (() => {});

	const file = await getV2Runner();
	php.writeFile(
		'/tmp/blueprints.phar',
		new Uint8Array(await file.arrayBuffer())
	);

	const parsedBlueprintDeclaration = parseBlueprintDeclaration(
		options.blueprint
	);
	let blueprintReference = '';
	switch (parsedBlueprintDeclaration.type) {
		case 'inline-file':
			php.writeFile(
				'/tmp/blueprint.json',
				parsedBlueprintDeclaration.contents
			);
			blueprintReference = '/tmp/blueprint.json';
			break;
		case 'file-reference':
			blueprintReference = parsedBlueprintDeclaration.reference;
			break;
	}

	const unbindMessageListener = await php.onMessage(async (message) => {
		try {
			const parsed =
				typeof message === 'string' ? JSON.parse(message) : message;
			if (!parsed) {
				return;
			}

			// Make sure stdout and stderr data is emited before the next message is processed.
			// Otherwise a code such as `echo "Hello"; post_message_to_js(json_encode([
			//    'type' => 'blueprint.error',
			//    'message' => 'Error'
			// ]));`
			// might emit the message before we process the stdout data.
			//
			// This is a workaround to ensure that the message is emitted after the stdout data is processed.
			// @TODO: Remove this workaround. Find the root cause why stdout data is delayed and address it
			//        directly.
			await new Promise((resolve) => setTimeout(resolve, 0));

			if (parsed.type.startsWith('blueprint.')) {
				await onMessage(parsed);
			}
		} catch (e) {
			logger.warn('Failed to parse message as JSON:', message, e);
		}
	});

	/**
	 * Prepare hooks, filters, and run the Blueprint:
	 */
	await php?.writeFile(
		'/tmp/run-blueprints.php',
		`<?php
function playground_http_client_factory() {
	return new WordPress\\HttpClient\\Client([
		// sockets transport is somehow faster than curl in Playground. Maybe
		// it uses a larger chunk size?
		'transport' => 'sockets',
	]);
}
playground_add_filter('blueprint.http_client', 'playground_http_client_factory');

function playground_on_blueprint_target_resolved() {
	post_message_to_js(json_encode([
		'type' => 'blueprint.target_resolved',
	]));
}
playground_add_filter('blueprint.target_resolved', 'playground_on_blueprint_target_resolved');

playground_add_filter('blueprint.resolved', 'playground_on_blueprint_resolved');
function playground_on_blueprint_resolved($blueprint) {
	$additional_blueprint_steps = json_decode(${phpVar(
		JSON.stringify(options.blueprintOverrides?.additionalSteps || [])
	)}, true);
	if(count($additional_blueprint_steps) > 0) {
		$blueprint['additionalStepsAfterExecution'] = array_merge(
			$blueprint['additionalStepsAfterExecution'] ?? [],
			$additional_blueprint_steps
		);
	}

	$wp_version_override = json_decode(${phpVar(
		JSON.stringify(options.blueprintOverrides?.wordpressVersion || null)
	)}, true);
	if($wp_version_override) {
		$blueprint['wordpressVersion'] = $wp_version_override;
	}
	return $blueprint;
}

function playground_progress_reporter() {
	class PlaygroundProgressReporter implements ProgressReporter {

		public function reportProgress(float $progress, string $caption): void {
			$this->writeJsonMessage([
				'type' => 'blueprint.progress',
				'progress' => round($progress, 2),
				'caption' => $caption
			]);
		}

		public function reportError(string $message, ?Throwable $exception = null): void {
			$errorData = [
				'type' => 'blueprint.error',
				'message' => $message
			];

			if ($exception) {
				$errorData['details'] = [
					'exception' => get_class($exception),
					'message' => $exception->getMessage(),
					'file' => $exception->getFile(),
					'line' => $exception->getLine(),
					'trace' => $exception->getTraceAsString()
				];
			}

			$this->writeJsonMessage($errorData);
		}

		public function reportCompletion(string $message): void {
			$this->writeJsonMessage([
				'type' => 'blueprint.completion',
				'message' => $message
			]);
		}

		public function close(): void {}

		private function writeJsonMessage(array $data): void {
			post_message_to_js(json_encode($data));
		}
	}
	return new PlaygroundProgressReporter();
}
playground_add_filter('blueprint.progress_reporter', 'playground_progress_reporter');
require( "/tmp/blueprints.phar" );
`
	);
	const streamedResponse = (await (php as any).cli([
		'/internal/shared/bin/php',
		'/tmp/run-blueprints.php',
		'exec',
		blueprintReference,
		...cliArgs,
	])) as StreamedPHPResponse;

	streamedResponse.finished.finally(unbindMessageListener);

	return streamedResponse;
}
