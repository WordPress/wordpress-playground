import type { PHPResponse, UniversalPHP } from '@php-wasm/universal';
import { getV2Runner } from '@wp-playground/blueprints';

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

export type BlueprintV2Declaration = string | Record<string, any> | undefined;
export type ParsedBlueprintV2Declaration =
	| { type: 'inline-file'; contents: string }
	| { type: 'file-reference'; reference: string };

function parseBlueprintDeclaration(
	source: BlueprintV2Declaration | ParsedBlueprintV2Declaration
): ParsedBlueprintV2Declaration {
	if (
		typeof source === 'object' &&
		'string' !== typeof (source as any) &&
		'type' in (source as any) &&
		['inline-file', 'file-reference'].includes((source as any).type)
	) {
		return source as ParsedBlueprintV2Declaration;
	}
	if (!source) {
		return { type: 'inline-file', contents: '{}' };
	}
	if (typeof source !== 'string') {
		return { type: 'inline-file', contents: JSON.stringify(source) };
	}
	try {
		JSON.parse(source);
		return { type: 'inline-file', contents: source };
	} catch {
		return { type: 'file-reference', reference: source };
	}
}

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

const blueprintsFilters = `function playground_http_client_factory() {
	return new WordPress\\HttpClient\\Client([
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

// playground_add_filter('blueprint.resolved', 'playground_on_blueprint_resolved');
function playground_on_blueprint_resolved($blueprint) {
	$additional_blueprint_steps = json_decode(getenv('ADDITIONAL_BLUEPRINT_STEPS') ?: '[]', true);
	if(count($additional_blueprint_steps) > 0) {
		$blueprint['additionalStepsAfterExecution'] = array_merge(
			$blueprint['additionalStepsAfterExecution'] ?? [],
			$additional_blueprint_steps
		);
	}

	$wp_version_override = getenv('WP_VERSION_OVERRIDE') ?: null;
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
`;

export async function runBlueprintV2Web(
	options: RunV2Options
): Promise<PHPResponse> {
	console.log('runBlueprintV2Web', options);

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
				return undefined;
			}
			if (parsed.type && parsed.type.startsWith('blueprint.')) {
				await onMessage(parsed);
				return 'handled!';
			}
			return undefined;
		} catch {
			// Ignore parse errors
		}
		return undefined;
	});

	// @TODO: Careful with pre-existing sites!
	if (await php.fileExists('/wordpress')) {
		await php.rmdir('/wordpress', { recursive: true });
		await php.mkdir('/wordpress');
	}

	await php?.writeFile(
		'/tmp/run-blueprints.php',
		`<?php

${blueprintsFilters}

// Include the phar and trigger its CLI execution
require( "/tmp/blueprints.phar" );
`
	);
	console.log({ blueprintReference });
	console.log('before runStream', {
		siteUrl: await php.absoluteUrl,
	});

	const r = await php.cli(
		[
			'/internal/shared/bin/php',
			'/tmp/run-blueprints.php',
			'exec',
			blueprintReference,
			'--site-path=/wordpress',
			'--db-engine=sqlite',
			'--db-path=/wordpress/wp-content/databases/.ht.sqlite',
			'--target-site-url=' + (await php.absoluteUrl),
			'--execution-mode=create-new-site',
		],
		{
			env: {
				ADDITIONAL_BLUEPRINT_STEPS: JSON.stringify(
					options.blueprintOverrides?.additionalSteps || []
				),
				WP_VERSION_OVERRIDE:
					options.blueprintOverrides?.wordpressVersion || '',
			},
		}
	);
	unbindMessageListener();
	console.log('after runStream', r);
	return r;
}
