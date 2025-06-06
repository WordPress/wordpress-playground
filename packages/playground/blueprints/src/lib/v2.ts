import { UniversalPHP } from '@php-wasm/universal';
// @ts-ignore
import v2_runner_url from '../../public/blueprints.phar?url';
import { ensureWpConfig } from '@wp-playground/wordpress';

interface RunV2Options {
	php: UniversalPHP;
	blueprintJSON: string;
	siteUrl: string;
	documentRoot: string;
	hooks?: {
		afterBlueprintTargetResolved?: (
			php: UniversalPHP
		) => void | Promise<void>;
		beforeWordPressFiles?: (php: UniversalPHP) => void | Promise<void>;
		onProgress?: (progress: number, caption: string) => void;
		/**
		 * @TODO: Do we need this? How is it different from throwing
		 * an error?
		 */
		onError?: (error: string, details?: unknown) => void;
	};
}

export async function runBlueprintV2(options: RunV2Options) {
	const php = options.php;
	const onProgress = options.hooks?.onProgress || (() => {});
	const onError = options.hooks?.onError || (() => {});

	// beforeWordPressFiles
	if (options.hooks?.beforeWordPressFiles) {
		await options.hooks.beforeWordPressFiles(php);
	}
	const file = await getV2Runner();
	php.writeFile(
		'/tmp/blueprints.phar',
		new Uint8Array(await file.arrayBuffer())
	);
	php.writeFile('/tmp/blueprint.json', options.blueprintJSON);

	// @TODO: Unbind this listener after a successful run.
	//        Maybe propagate messages via addEventListener etc?
	await php.onMessage(async (message) => {
		try {
			const parsed =
				typeof message === 'string' ? JSON.parse(message) : message;
			if (!parsed) {
				return;
			}
			switch (parsed.type) {
				case 'blueprint.target_resolved':
					// @TODO: Rethink these debug constants. We shouldn't
					//        always set them, right?
					php.defineConstant('WP_DEBUG', true);
					php.defineConstant('WP_DEBUG_LOG', true);
					php.defineConstant('WP_DEBUG_DISPLAY', false);

					/*
					 * Add required constants to "wp-config.php" if they are not already defined.
					 * This is needed, because some WordPress backups and exports may not include
					 * definitions for some of the necessary constants.
					 */
					await ensureWpConfig(php, options.documentRoot);

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
					onError?.(parsed.error, parsed.details);
					break;
			}
		} catch (e) {
			console.warn('Failed to parse message as JSON:', message, e);
		}
	});

	await php?.writeFile('/tmp/stdout', '');
	await php?.writeFile('/tmp/stderror', '');
	await php?.writeFile(
		'/tmp/run-blueprints.php',
		`<?php
// Set up the environment to emulate a shell script
// call.

// Set the argv global.
$_SERVER['argv'] = $GLOBALS['argv'] = array_merge([
	"/tmp/blueprints.phar",
], json_decode(getenv('ARGV')));

// Provide stdin, stdout, stderr streams outside of
// the CLI SAPI.
define('STDIN', fopen('php://stdin', 'rb'));
define('STDOUT', fopen('php://stdout', 'wb'));
define('STDERR', fopen('/tmp/stderr', 'wb'));

function playground_on_blueprint_target_resolved() {
	return new PlaygroundProgressReporter();
}
playground_add_filter('blueprint.target_resolved', 'playground_on_blueprint_target_resolved');




function playground_progress_reporter() {
class PlaygroundProgressReporter implements ProgressReporter {

    public function reportProgress(float $progress, string $caption): void {
        $this->writeJsonMessage([
            'type' => 'blueprint.progress',
            'progress' => round($progress, 2),
            'caption' => $caption
        ]);
    }

    public function reportError(string $message, ?\Throwable $exception = null): void {
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

	return await php.run({
		scriptPath: '/tmp/run-blueprints.php',
		env: {
			ARGV: JSON.stringify([
				'exec',
				'/tmp/blueprint.json',
				'--site-path=/wordpress',
				`--site-url=${options.siteUrl}`,
				'--db-engine=sqlite',
				'--truncate-new-site-directory=true',
			]),
		},
	});
}

export async function getV2Runner(): Promise<File> {
	let data = null;
	if (v2_runner_url.startsWith('/')) {
		console.log('v2_runner_url', v2_runner_url);
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
