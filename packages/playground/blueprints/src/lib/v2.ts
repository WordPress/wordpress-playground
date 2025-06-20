import type { StreamedPHPResponse, UniversalPHP } from '@php-wasm/universal';
import { logger } from '@php-wasm/logger';
// @ts-ignore
import v2_runner_url from '../../public/blueprints.phar?url';
import type { BlueprintDeclaration } from './blueprint';
import { phpVar } from '@php-wasm/util';

interface RunV2Options {
	php: UniversalPHP;
	cliArgs?: string[];
	blueprint: BlueprintV2Declaration | ParsedBlueprintV2Declaration;
	blueprintOverrides?: {
		wordpressVersion?: string;
		additionalSteps?: any[];
	};
	hooks?: {
		afterBlueprintTargetResolved?: (
			php: UniversalPHP
		) => void | Promise<void>;
		onProgress?: (progress: number, caption: string) => void;
		/**
		 * A hook that is called when an error occurs. It provides succinct
		 * error messages and structured details. Useful for reporting specific
		 * errors to the user without displaying the full stack trace.
		 *
		 * @param message The error message.
		 * @param details The error details.
		 */
		onError?: (message: string, details?: PHPExceptionDetails) => void;
	};
}

export type PHPExceptionDetails = {
	exception: string;
	message: string;
	file: string;
	line: number;
	trace: string;
};

export async function runBlueprintV2(options: RunV2Options) {
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
	const onProgress = options.hooks?.onProgress || (() => {});
	const onError = options.hooks?.onError || (() => {});

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
			switch (parsed.type) {
				case 'blueprint.target_resolved':
					/*
					 * Add required constants to "wp-config.php" if they are not already defined.
					 * This is needed, because some WordPress backups and exports may not include
					 * definitions for some of the necessary constants.
					 */

					if (options.hooks?.afterBlueprintTargetResolved) {
						await options.hooks.afterBlueprintTargetResolved(php);
					}
					break;
				case 'blueprint.progress':
					onProgress?.(
						parsed.progress,
						parsed.caption || 'Running the Blueprint'
					);
					break;
				case 'blueprint.error':
					onError?.(parsed.message, parsed.details);
					break;
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
	 * Only load the v2 runner via node:fs when running in Node.js.
	 */
	if (typeof process !== 'undefined' && process.versions?.node) {
		let path = v2_runner_url;
		if (path.startsWith('/@fs/')) {
			path = path.slice(4);
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
