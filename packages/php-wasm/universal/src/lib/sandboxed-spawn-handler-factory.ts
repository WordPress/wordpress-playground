import { createSpawnHandler } from '@php-wasm/util';
import type { PHPProcessManager } from './php-process-manager';

/**
 * An isomorphic proc_open() handler that implements typical shell in TypeScript
 * without relying on a server runtime. It can be used in the browser and Node.js
 * alike whenever you need to spawn a PHP subprocess, query the terminal size, etc.
 * It is open for future expansion if more shell or busybox calls are needed, but
 * advanced shell features such as piping, stream redirection etc. are outside of
 * the scope of this minimal handler. If they become vital at any point, let's
 * explore bringing in an actual shell implementation or at least a proper command
 * parser.
 */
export function sandboxedSpawnHandlerFactory(
	processManager: PHPProcessManager
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
			processApi.on('stdin', (data) => {
				processApi.stdout(data);
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

		if (!['php', 'ls', 'pwd'].includes(binaryName ?? '')) {
			// 127 is the exit code "for command not found".
			processApi.exit(127);
			return;
		}

		const { php, reap } = await processManager.acquirePHPInstance({
			considerPrimary: false,
		});

		try {
			if (options.cwd) {
				php.chdir(options.cwd as string);
			}

			const cwd = php.cwd();
			switch (binaryName) {
				case 'php': {
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
					break;
				}
				case 'ls': {
					const files = php.listFiles(args[1] ?? cwd);
					for (const file of files) {
						processApi.stdout(file + '\n');
					}
					// Technical limitation of subprocesses – we need to
					// wait before exiting to give consumer a chance to read
					// the output.
					await new Promise((resolve) => setTimeout(resolve, 10));
					processApi.exit(0);
					break;
				}
				case 'pwd': {
					processApi.stdout(cwd + '\n');
					// Technical limitation of subprocesses – we need to
					// wait before exiting to give consumer a chance to read
					// the output.
					await new Promise((resolve) => setTimeout(resolve, 10));
					processApi.exit(0);
					break;
				}
			}
		} catch (e) {
			// An exception here means the PHP runtime has crashed.
			processApi.exit(1);
			throw e;
		} finally {
			reap();
		}
	});
}
