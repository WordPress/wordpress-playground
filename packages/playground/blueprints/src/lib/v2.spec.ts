import { logger } from '@php-wasm/logger';
import { loadNodeRuntime } from '@php-wasm/node';
import type { PHPProcessManager, PHPRequestHandler } from '@php-wasm/universal';
import { createSpawnHandler } from '@php-wasm/util';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { bootRequestHandler } from '@wp-playground/wordpress';
import { rootCertificates } from 'node:tls';
import { runBlueprintV2 } from './v2';

describe('V2 runner', () => {
	let handler: PHPRequestHandler;

	beforeEach(async () => {
		handler = await bootRequestHandler({
			createPhpRuntime: async () =>
				await loadNodeRuntime(RecommendedPHPVersion),
			sapiName: 'cli',
			siteUrl: 'http://playground-domain/',
			phpIniEntries: {
				'openssl.cafile': '/internal/shared/ca-bundle.crt',
			},
			createFiles: {
				'/internal/shared/ca-bundle.crt': rootCertificates.join('\n'),
			},
			spawnHandler: spawnHandlerFactory,
		});
	});

	it('should put WordPress in the document root', async () => {
		const instance = await handler.processManager.acquirePHPInstance();
		const result = await runBlueprintV2({
			php: instance.php as any,
			blueprint: '{"version":2}',
			siteUrl: 'http://playground-domain/',
			documentRoot: '/wordpress',
		});
		await result.finished;
		const instance2 = await handler.processManager.acquirePHPInstance();
		expect(instance2.php.listFiles('/wordpress')).toContain('wp-content');
	}, 60000);
});

export function spawnHandlerFactory(processManager: PHPProcessManager) {
	return createSpawnHandler(async function (args, processApi, options) {
		processApi.notifySpawn();
		if (args[0] === 'exec') {
			args.shift();
		}

		if (args[0].endsWith('.php') || args[0].endsWith('.phar')) {
			args.unshift('php');
		}

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
		} else if (args[0] === 'tput' && args[1] === 'cols') {
			processApi.stdout(`140`);
			processApi.exit(0);
		} else if (args[0] === 'less') {
			processApi.on('stdin', (data: Uint8Array) => {
				processApi.stdout(data);
			});
			processApi.flushStdin();
			processApi.exit(0);
		} else if (args[0] === 'php') {
			const { php, reap } = await processManager.acquirePHPInstance({
				considerPrimary: false,
			});

			php.chdir(options.cwd as string);
			try {
				// Figure out more about setting env, putenv(), etc.
				const result = await php.cli(args, {
					env: {
						...options.env,
						DOCROOT: '/wordpress',
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
						console.error('Error in childPHP:', error);
						processApi.exit(1);
					}
				);
			} catch (e) {
				logger.error('Error in childPHP:', e);
				if (e instanceof Error) {
					processApi.stderr(e.message);
				}
				processApi.exit(1);
			} finally {
				reap();
			}
		} else {
			processApi.exit(1);
		}
	});
}
