import type { UniversalPHP } from '@php-wasm/universal';
// @ts-ignore
import v2_runner_url from '../../public/blueprints.phar?url';
import { ensureWpConfig } from '@wp-playground/wordpress';
import type { BlueprintDeclaration } from './blueprint';
import { logger } from '@php-wasm/logger';

interface RunV2Options {
	php: UniversalPHP;
	blueprint: BlueprintV2Declaration | ParsedBlueprintV2Declaration;
	siteUrl: string;
	documentRoot: string;
	hooks?: {
		afterBlueprintTargetResolved?: (
			php: UniversalPHP
		) => void | Promise<void>;
		beforeWordPressFiles?: (php: UniversalPHP) => void | Promise<void>;
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
					onError?.(parsed.message, parsed.details);
					break;
			}
		} catch (e) {
			logger.warn('Failed to parse message as JSON:', message, e);
		}
	});

	await php?.writeFile('/tmp/stdout', '');
	await php?.writeFile('/tmp/stderror', '');
	await php?.writeFile(
		'/tmp/run-blueprints.php',
		`<?php
// Set up the environment to emulate a shell script
// call.
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

	// @TODO: Remove this cast. Add the cli() method to UniversalPHP.
	return await (php as any).cli([
		'php',
		'/tmp/run-blueprints.php',
		'exec',
		blueprintReference,
		'--site-path=/wordpress',
		`--site-url=${options.siteUrl}`,
		'--db-engine=sqlite',
		// '--truncate-new-site-directory=true',
	]);
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
