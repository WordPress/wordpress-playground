import { createSpawnHandler } from '@php-wasm/util';
import type { PHPProcessManager } from './php-process-manager';
import { logger } from '@php-wasm/logger';

export function sandboxedSpawnHandlerFactory(
	processManager: PHPProcessManager,
	factoryOptions: {
		onError: (error: Error) => void;
	} = {
		onError: (error) => {
			logger.error('Error in childPHP:', error);
		},
	}
) {
	return createSpawnHandler(async function (args, processApi, options) {
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
		} else if (binaryName === 'tput' && args[1] === 'cols') {
			processApi.stdout(`140`);
			processApi.exit(0);
		} else if (binaryName === 'less') {
			processApi.on('stdin', (data: Uint8Array) => {
				processApi.stdout(data);
			});
			processApi.flushStdin();
			processApi.exit(0);
		} else if (binaryName === 'php') {
			const { php, reap } = await processManager.acquirePHPInstance({
				considerPrimary: false,
			});

			php.chdir(options.cwd as string);
			try {
				// Figure out more about setting env, putenv(), etc.
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
							processApi.stdout(chunk);
						},
					})
				);
				result.stderr.pipeTo(
					new WritableStream({
						write(chunk) {
							processApi.stderr(chunk);
						},
					})
				);
				await result.exitCode.then(
					(exitCode) => {
						processApi.exit(exitCode);
					},
					(error) => {
						factoryOptions.onError(error as Error);
						processApi.exit(1);
					}
				);
			} catch (e) {
				factoryOptions.onError(e as Error);
				processApi.exit(1);
			} finally {
				reap();
			}
		} else {
			processApi.exit(1);
		}
	});
}
