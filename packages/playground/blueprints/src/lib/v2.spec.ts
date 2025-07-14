import { loadNodeRuntime } from '@php-wasm/node';
import type { PHPProcessManager, PHPResponse } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import type { PHPRequestHandler } from '@php-wasm/universal';
import { bootRequestHandler } from '@wp-playground/wordpress';
import { runBlueprintV2 } from './v2';
import { rootCertificates } from 'node:tls';
import { createSpawnHandler, phpVar } from '@php-wasm/util';
import { logger } from '@php-wasm/logger';

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

	// @TODO: Unskip this test. It needs the rest of the https://github.com/WordPress/wordpress-playground/pull/2238 to be merged
	// before it will pass.
	it.skip(
		'should run the runner',
		async () => {
			const { php } = await handler.processManager.acquirePHPInstance();
			const result = await runBlueprintV2({
				php: php as any,
				blueprint: '{"version":2}',
				siteUrl: 'http://playground-domain/',
				documentRoot: '/wordpress',
				hooks: {
					afterBlueprintTargetResolved: async () => {
						console.log('Blueprint target resolved');
						process.exit(0);
					},
				},
			});
			expect(await result?.stdoutText).toBe('Hello, World!');
		},
		{
			timeout: 60000,
		}
	);
});

export function spawnHandlerFactory(processManager: PHPProcessManager) {
	return createSpawnHandler(async function (args, processApi, options) {
		console.log('Spawn handler called', args);
		processApi.notifySpawn();
		if (args[0] === 'exec') {
			args.shift();
		}

		if (args[0].endsWith('.php')) {
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

			processApi.exit(0);
		} else if (args[0] === 'fetch') {
			fetch(args[1]).then(async (res) => {
				const reader = res.body?.getReader();
				if (!reader) {
					processApi.exit(1);
					return;
				}
				while (true) {
					const { done, value } = await reader.read();
					if (done) {
						processApi.exit(0);
						break;
					}
					processApi.stdout(value);
				}
			});
			return;
		} else if (args[0] === 'php') {
			const { php, reap } = await processManager.acquirePHPInstance();

			let result: PHPResponse | undefined = undefined;
			try {
				// @TODO: Run the actual PHP CLI SAPI instead of
				//        interpreting the arguments and emulating
				//        the CLI constants and globals.
				const cliBootstrapScript = `<?php
                // Set the argv global.
                $_SERVER['argv'] = $GLOBALS['argv'] = array_merge([
                    "/wordpress/wp-cli.phar",
                    "--path=/wordpress"
                ], ${phpVar(args.slice(2))});
                $_SERVER['argc'] = $GLOBALS['argc'] = count($argv);

                // Provide stdin, stdout, stderr streams outside of
                // the CLI SAPI.
                define('STDIN', fopen('php://stdin', 'rb'));
                define('STDOUT', fopen('php://stdout', 'wb'));
                define('STDERR', fopen('/tmp/stderr', 'wb'));

				// Set DOCROOT to the current working directory.
				if(getenv("DOCROOT")) {
					chdir(getenv("DOCROOT"));
				}
                `;

				const code = args.includes('-r')
					? args[args.indexOf('-r') + 1]
					: `require( getenv("SCRIPT_PATH") );`;

				result = await php.run({
					code: `${cliBootstrapScript} ${code}`,
					env: {
						...options.env,
						DOCROOT: '/wordpress',

						// Set SHELL_PIPE to 0 to ensure WP-CLI formats
						// the output as ASCII tables.
						// @see https://github.com/wp-cli/wp-cli/issues/1102
						SHELL_PIPE: '0',

						SCRIPT_PATH: args[1],
					},
				});

				processApi.stdout(result.bytes);
				processApi.stderr(result.errors);
				processApi.exit(result.exitCode);
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
