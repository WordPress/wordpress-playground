import { createSpawnHandler, type ProcessApi } from '@php-wasm/util';
import type { PHP } from './php';
import type { SpawnHandler } from './universal-php';

export interface ProcessOptions {
	cwd?: string;
	env?: Record<string, string>;
}

/**
 * Handler for PHP CLI commands. Called when a PHP command is spawned.
 * Should stream output to processApi and call processApi.exit() when done.
 */
export type PHPCliHandler = (
	args: string[],
	processApi: ProcessApi,
	options: ProcessOptions
) => Promise<void>;

export interface SpawnHandlerOptions {
	/**
	 * Function to get a PHP instance for filesystem operations (ls, pwd).
	 */
	getPrimaryPhp: () => Promise<PHP>;

	/**
	 * Handler for PHP CLI commands.
	 * If not provided, PHP commands will return exit code 127 (command not found).
	 */
	phpCliHandler?: PHPCliHandler;
}

/**
 * Creates a spawn handler for proc_open() calls that handles common shell commands.
 *
 * This handler implements typical shell commands in TypeScript without relying on
 * a server runtime. It can be used in the browser and Node.js alike whenever you
 * need to spawn a PHP subprocess, query the terminal size, etc.
 *
 * Supported commands:
 * - `php` - Runs PHP CLI (requires phpCliHandler)
 * - `ls` - Lists files using PHP filesystem
 * - `pwd` - Prints working directory
 * - `stty size` - Returns terminal size (hardcoded)
 * - `tput cols` - Returns terminal columns (hardcoded)
 * - `less` - Pipes stdin to stdout
 *
 * Advanced shell features such as piping, stream redirection etc. are outside of
 * the scope of this minimal handler.
 */
export function createPhpSpawnHandler(
	options: SpawnHandlerOptions
): SpawnHandler {
	const { getPrimaryPhp, phpCliHandler } = options;

	return createSpawnHandler(
		async function (args, processApi, processOptions) {
			processApi.notifySpawn();

			if (args[0] === 'exec') {
				args.shift();
			}

			if (args[0].endsWith('.php') || args[0].endsWith('.phar')) {
				args.unshift('php');
			}

			const binaryName = args[0].split('/').pop();

			// Mock programs required by wp-cli:
			if (
				args[0] === '/usr/bin/env' &&
				args[1] === 'stty' &&
				args[2] === 'size'
			) {
				// These numbers are hardcoded because this
				// spawnHandler is transmitted as a string to
				// the PHP backend and has no access to local
				// scope. It would be nice to find a way to
				// transfer / proxy a live object instead.
				// @TODO: Do not hardcode this
				processApi.stdout(`18 140`);
				processApi.exit(0);
				return;
			}

			if (binaryName === 'tput' && args[1] === 'cols') {
				processApi.stdout(`140`);
				processApi.exit(0);
				return;
			}

			if (binaryName === 'less') {
				processApi.on('stdin', (data: Uint8Array | string) => {
					processApi.stdout(
						data instanceof Uint8Array ? data.buffer : data
					);
				});
				// Exit after the stdin stream is exhausted.
				await new Promise((resolve) => {
					processApi.childProcess.stdin.on('finish', () => {
						resolve(true);
					});
				});
				processApi.exit(0);
				return;
			}

			// Handle PHP commands
			if (binaryName === 'php') {
				if (phpCliHandler) {
					await phpCliHandler(args, processApi, processOptions);
				} else {
					processApi.stderr(
						'PHP subprocess spawning is not available in this environment.\n'
					);
					processApi.exit(127);
				}
				return;
			}

			// Handle filesystem commands using PHP's filesystem
			if (binaryName === 'ls' || binaryName === 'pwd') {
				const php = await getPrimaryPhp();

				try {
					if (processOptions.cwd) {
						php.chdir(processOptions.cwd as string);
					}

					const cwd = php.cwd();

					if (binaryName === 'ls') {
						const files = php.listFiles(args[1] ?? cwd);
						for (const file of files) {
							processApi.stdout(file + '\n');
						}
					} else if (binaryName === 'pwd') {
						processApi.stdout(cwd + '\n');
					}

					// Technical limitation of subprocesses – we need to
					// wait before exiting to give consumer a chance to read
					// the output.
					await new Promise((resolve) => setTimeout(resolve, 10));
					processApi.exit(0);
				} catch (e) {
					processApi.exit(1);
					throw e;
				}
				return;
			}

			// 127 is the exit code "for command not found".
			processApi.exit(127);
		}
	);
}

/**
 * Creates a PHP CLI handler that spawns PHP instances via PHPProcessManager.
 * This is used for web environments where multiple PHP instances can coexist
 * in the same process.
 */
export function createProcessManagerCliHandler(
	acquirePHPInstance: () => Promise<{ php: PHP; reap: () => void }>
): PHPCliHandler {
	return async (args, processApi, options) => {
		const { php, reap } = await acquirePHPInstance();

		try {
			if (options.cwd) {
				php.chdir(options.cwd as string);
			}

			const result = await php.cli(args, {
				env: {
					...options.env,
					SCRIPT_PATH: args[1],
					// Set SHELL_PIPE to 0 to ensure WP-CLI formats
					// the output as ASCII tables.
					// @see https://github.com/wp-cli/wp-cli/issues/1102
					SHELL_PIPE: '0',
				},
			});

			result.stdout.pipeTo(
				new WritableStream({
					write(chunk) {
						processApi.stdout(chunk as any as ArrayBuffer);
					},
				})
			);
			result.stderr.pipeTo(
				new WritableStream({
					write(chunk) {
						processApi.stderr(chunk as any as ArrayBuffer);
					},
				})
			);
			processApi.exit(await result.exitCode);
		} catch (e) {
			// An exception here means the PHP runtime has crashed.
			processApi.exit(1);
			throw e;
		} finally {
			reap();
		}
	};
}

/**
 * Legacy wrapper that creates a spawn handler using PHPRequestHandler.
 *
 * For web environments with multi-instance PHP support (maxPhpInstances > 1),
 * this creates a spawn handler that can spawn new PHP instances for subprocesses.
 *
 * For CLI environments with single-instance PHP (maxPhpInstances = 1), use
 * createPhpSpawnHandler directly with your own phpCliHandler (or none).
 */
export function sandboxedSpawnHandlerFactory(requestHandler: {
	processManager?: {
		acquirePHPInstance: (options?: {
			considerPrimary?: boolean;
		}) => Promise<{ php: PHP; reap: () => void }>;
	};
	getPrimaryPhp: () => Promise<PHP>;
}): SpawnHandler {
	const { processManager } = requestHandler;

	return createPhpSpawnHandler({
		getPrimaryPhp: () => requestHandler.getPrimaryPhp(),
		phpCliHandler: processManager
			? createProcessManagerCliHandler(() =>
					processManager.acquirePHPInstance({
						considerPrimary: false,
					})
				)
			: undefined,
	});
}
