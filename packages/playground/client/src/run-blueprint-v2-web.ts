import { getV2Runner } from '@wp-playground/blueprints';
import type { StreamedPHPResponse, UniversalPHP } from '@php-wasm/universal';
import { phpVar } from '@php-wasm/util';

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

export type BlueprintV2Declaration =
	| string
	| Record<string, unknown>
	| undefined;

type ParsedBlueprintV2Declaration =
	| { type: 'inline-file'; contents: string }
	| { type: 'file-reference'; reference: string };

function parseBlueprintDeclaration(
	source: BlueprintV2Declaration | ParsedBlueprintV2Declaration
): ParsedBlueprintV2Declaration {
	if (
		typeof source === 'object' &&
		source !== null &&
		'type' in source &&
		(source as any).type &&
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

interface RunV2WebOptions {
	php: UniversalPHP;
	cliArgs?: string[];
	blueprint: BlueprintV2Declaration | ParsedBlueprintV2Declaration;
	blueprintOverrides?: {
		wordpressVersion?: string;
		additionalSteps?: any[];
	};
	onMessage?: (message: BlueprintMessage) => void | Promise<void>;
}

export async function runBlueprintV2Web(
	options: RunV2WebOptions
): Promise<StreamedPHPResponse> {
	const cliArgs = options.cliArgs ? [...options.cliArgs] : [];
	for (const arg of cliArgs) {
		if (arg.startsWith('--site-path=')) {
			throw new Error(
				'The --site-path CLI argument must not be provided. In Playground, it is always set to /wordpress.'
			);
		}
	}
	cliArgs.push('--site-path=/wordpress');

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

	const unbindMessageListener = await (php as any).onMessage(
		async (message: any) => {
			try {
				const parsed =
					typeof message === 'string' ? JSON.parse(message) : message;
				if (!parsed) return;
				await new Promise((resolve) => setTimeout(resolve, 0));
				if (parsed.type && parsed.type.startsWith('blueprint.')) {
					await onMessage(parsed);
				}
			} catch {
				// ignore non-JSON messages
			}
		}
	);

	await php?.writeFile(
		'/tmp/run-blueprints.php',
		`<?php
function playground_http_client_factory() {
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
      $errorData = [ 'type' => 'blueprint.error', 'message' => $message ];
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
