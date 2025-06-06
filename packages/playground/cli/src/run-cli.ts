/**
 * @TODO:
 * * Mount a stable system tmp or home/.playground-cli directory to store HTTP Cache.
 *   Flush stale entries periodically.
 */

import { errorLogPath, logger } from '@php-wasm/logger';
import { loadNodeRuntime } from '@php-wasm/node';
import { EmscriptenDownloadMonitor, ProgressTracker } from '@php-wasm/progress';
import type {
	PHP,
	PHPProcessManager,
	PHPRequest,
	PHPRequestHandler,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import { PHPResponse } from '@php-wasm/universal';
import type {
	BlueprintDeclaration,
	BlueprintBundle,
} from '@wp-playground/blueprints';
import {
	compileBlueprint,
	runBlueprintSteps,
	isBlueprintBundle,
} from '@wp-playground/blueprints';
import {
	bootRequestHandler,
	bootWordPress,
	resolveWordPressRelease,
} from '@wp-playground/wordpress';
import fs from 'fs';
import type { Server } from 'http';
import path from 'path';
import { rootCertificates } from 'tls';
import { expandAutoMounts } from './cli-auto-mount';
import {
	CACHE_FOLDER,
	cachedDownload,
	fetchSqliteIntegration,
	readAsFile,
} from './download';
import { startServer } from './server';
import { type Mount, mountResources } from './mount';
import { runBlueprintV2 } from '@wp-playground/blueprints';
import { createSpawnHandler, phpVar } from '@php-wasm/util';

export interface RunCLIArgs {
	blueprint?: BlueprintDeclaration | BlueprintBundle;
	command: 'server' | 'run-blueprint' | 'build-snapshot';
	debug?: boolean;
	login?: boolean;
	mount?: Mount[];
	mountBeforeInstall?: Mount[];
	outfile?: string;
	php: SupportedPHPVersion;
	port?: number;
	quiet?: boolean;
	skipWordPressSetup?: boolean;
	skipSqliteSetup?: boolean;
	wp?: string;
	autoMount?: boolean;
	followSymlinks?: boolean;
}

export interface RunCLIServer {
	requestHandler: PHPRequestHandler;
	server: Server;
}

export async function runCLI(args: RunCLIArgs): Promise<RunCLIServer> {
	/**
	 * Expand auto-mounts to include the necessary mounts and steps
	 * when running in auto-mount mode.
	 */
	if (args.autoMount) {
		args = expandAutoMounts(args);
	}

	if (args.quiet) {
		// @ts-ignore
		logger.handlers = [];
	}

	let requestHandler: PHPRequestHandler;
	let wordPressReady = false;

	logger.log('Starting a PHP server...');

	// @TODO: Support Blueprint bundles. Don't deal with Filesystem instances.
	//        Hm, maybe start with any PHP version and then switch once we
	//        used it to process the blueprint? Although the Blueprint may
	//        not be compatible with that PHP version :thinking:
	//
	//        Maybe a multi-stage processing in PHP? Stage 1: Parse the Blueprint,
	//        Stage 2: Process the blueprint and get the PHP version,
	//        Stage 3: Boot the PHP version and run the blueprint.
	//
	//        Hm... no. That would force browsers to download multiple PHP versions.
	//        I guess we need some code duplication to extract the PHP version in
	//        TypeScript and then pass the rest of the Blueprint/bundle to TypeScript.
	//
	//        Alternatively, we could require the caller to specify the PHP version
	//        and only use the Blueprint as a validation device? :thinking:
	//        Let's do that for now to reduce the complexity.

	return startServer({
		port: args['port'] as number,
		onBind: async (server: Server, port: number): Promise<RunCLIServer> => {
			const absoluteUrl = `http://127.0.0.1:${port}`;

			const blueprintJSON = await (
				await args.blueprint.read('/blueprint.json')
			).text();
			console.log(blueprintJSON);

			logger.log(`Setting up WordPress ${args.wp}`);

			requestHandler = await bootRequestHandler({
				siteUrl: absoluteUrl,
				createPhpRuntime: async () =>
					await loadNodeRuntime(args.php, {
						followSymlinks: args.followSymlinks === true,
					}),
				sapiName: 'cli',
				createFiles: {
					'/internal/shared/ca-bundle.crt':
						rootCertificates.join('\n'),
				},
				phpIniEntries: {
					'openssl.cafile': '/internal/shared/ca-bundle.crt',
					allow_url_fopen: '1',
					disable_functions: '',
				},
				cookieStore: false,
				spawnHandler: spawnHandlerFactory,
			});
			logger.log(`Booted!`);
			const { php, reap } =
				await requestHandler.processManager.acquirePHPInstance();
			try {
				await runBlueprintV2({
					php,
					blueprintJSON,
					siteUrl: absoluteUrl,
					documentRoot: '/wordpress',
					hooks: {
						beforeWordPressFiles: async (php) => {
							if (args.mountBeforeInstall) {
								mountResources(
									php as PHP,
									args.mountBeforeInstall
								);
							}
						},
						onProgress: (progress, caption) => {
							const message = `${caption.trim()} – ${progress.toFixed(
								2
							)}%`;
							process.stdout.write('\r\x1b[K' + message);
						},
					},
				});
				wordPressReady = true;

				if (args.command === 'build-snapshot') {
					await zipDirectory(php, '/wordpress', '/tmp/build.zip');
					const zip = php.readFileAsBuffer('/tmp/build.zip');
					fs.writeFileSync(args.outfile as string, zip);
					php.unlink('/tmp/build.zip');

					logger.log(`WordPress exported to ${args.outfile}`);
					process.exit(0);
				} else if (args.command === 'run-blueprint') {
					logger.log(`Blueprint executed`);
					process.exit(0);
				} else {
					logger.log(`WordPress is running on ${absoluteUrl}`);
				}

				return { requestHandler, server };
			} catch (error) {
				console.log('No bosz');
				console.log(error);
				if (!args.debug) {
					throw error;
				}
				const phpLogs = php.readFileAsText(errorLogPath);
				throw new Error(phpLogs, { cause: error });
			} finally {
				reap();
			}
		},
		async handleRequest(request: PHPRequest) {
			if (!wordPressReady) {
				return PHPResponse.forHttpCode(
					502,
					'WordPress is not ready yet'
				);
			}
			return await requestHandler.request(request);
		},
	});
}

async function zipDirectory(php: PHP, directory: string, zipPath: string) {
	await php.run({
		code: `<?php
			$zip = new ZipArchive();
			if(false === $zip->open(getenv('ZIP_PATH'), ZipArchive::CREATE | ZipArchive::OVERWRITE)) {
				throw new Exception('Failed to create ZIP');
			}
			$files = new RecursiveIteratorIterator(
				new RecursiveDirectoryIterator(getenv('DIRECTORY_PATH'))
			);
			foreach ($files as $file) {
				if ($file->isFile()) {
					$zip->addFile($file->getPathname(), $file->getPathname());
				}
			}
			$zip->close();
		`,
		env: {
			DIRECTORY_PATH: directory,
			ZIP_PATH: zipPath,
		},
	});
}

export function spawnHandlerFactory(processManager: PHPProcessManager) {
	return createSpawnHandler(async function (args, processApi, options) {
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
			processApi.flushStdin();
			processApi.exit(0);
		} else if (args[0] === 'fetch') {
			processApi.flushStdin();
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
                define('STDERR', fopen('php://stderr', 'wb'));

				error_reporting(E_ALL);
				ini_set('display_errors', '1');
				ini_set('log_errors', '1');
				ini_set('error_log', 'php://stderr');

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
