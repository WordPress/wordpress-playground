import type { StreamedPHPResponse, UniversalPHP } from '@php-wasm/universal';
import { phpVar } from '@php-wasm/util';
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

export async function runBlueprintV2Web(
	options: RunV2Options
): Promise<StreamedPHPResponse> {
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
			console.log(parsedBlueprintDeclaration.contents);
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

use WordPress\\CLI\\CLI;
use WordPress\\Blueprints\\DataReference\\AbsoluteLocalPath;
use WordPress\\Blueprints\\DataReference\\DataReference;
use WordPress\\Blueprints\\DataReference\\ExecutionContextPath;
use WordPress\\Blueprints\\Exception\\BlueprintExecutionException;
use WordPress\\Blueprints\\Exception\\PermissionsException;
use WordPress\\Blueprints\\Logger\\CLILogger;
use WordPress\\Blueprints\\ProgressObserver;
use WordPress\\Blueprints\\Runner;
use WordPress\\Blueprints\\RunnerConfiguration;
use WordPress\\Filesystem\\LocalFilesystem;

$argv = [];
$GLOBALS['argv'] = $_SERVER['argv'] = array_merge([
	"/tmp/blueprints.phar"
], []);

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

// playground_add_filter('blueprint.resolved', 'playground_on_blueprint_resolved');
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
post_message_to_js(json_encode([
	'type' => 'blueprint.target_resolved',
]));

$argv = [];
require( "/tmp/blueprints.phar" );

$config = new RunnerConfiguration();

// The first positional is the blueprint reference
try {
	$blueprint_reference = ${phpVar(blueprintReference)};
	$config->setBlueprint( DataReference::create( $blueprint_reference, [
		AbsoluteLocalPath::class,
		ExecutionContextPath::class,
	] ) );
} catch ( InvalidArgumentException $e ) {
	throw new InvalidArgumentException( sprintf( "Invalid Blueprint reference: %s. Hint: paths must start with ./ or /. URLs must start with http:// or https://.", $positionalArgs[0] ) );
}

$config->setExecutionMode( Runner::EXECUTION_MODE_CREATE_NEW_SITE );

$targetSiteRoot = '/wordpress';

$absoluteTargetSiteRoot = realpath( $targetSiteRoot );
if ( false === $absoluteTargetSiteRoot || ! is_dir( $absoluteTargetSiteRoot ) ) {
	throw new InvalidArgumentException( "The --site-path path does not exist: {$targetSiteRoot}" );
}
$config->setTargetSiteRoot( $absoluteTargetSiteRoot );
$config->setTargetSiteUrl( ${phpVar(await php.absoluteUrl)} );

// Set database engine
$config->setDatabaseEngine( 'sqlite' );
$config->setDatabaseCredentials( [
	'path' => '/wordpress/wp-content/databases/.ht.sqlite',
] );

$config->setLogger(
	new CLILogger( 'php://stdout', CLILogger::VERBOSITY_INFO )
);
$config->setProgressObserver( new ProgressObserver( function ( $progress, $caption ) use ( $progressReporter ) {
	$progressReporter->reportProgress( $progress, $caption );
} ) );
$runner = new Runner( $config );
$runner->run();
`
	);
	console.log({ blueprintReference });
	console.log('before runStream', {
		siteUrl: await php.absoluteUrl,
	});

	const r = await php.run({
		scriptPath: '/tmp/run-blueprints.php',
	});
	unbindMessageListener();
	console.log('after runStream', r);
	return r;
}
