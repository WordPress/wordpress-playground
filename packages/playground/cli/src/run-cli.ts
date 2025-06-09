/**
 * @TODO:
 * * Mount a stable system tmp or home/.playground-cli directory to store HTTP Cache.
 *   Flush stale entries periodically.
 * * Find a consistent logging interface. Right now we have a logger for some things and output.stdout for other things.
 *   In the browser, logger prints information to the devtools console which is only needed for debugging. The HTML makes
 *   for the UI. In CLI, the console and the UI are the same thing. Perhaps we actually need to separate what we print for
 *   UI reasons from what we print for debugging?
 */

import { errorLogPath, logToMemory, logger } from '@php-wasm/logger';
import { loadNodeRuntime } from '@php-wasm/node';
import type {
	PHP,
	PHPProcessManager,
	PHPRequest,
	PHPRequestHandler,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import { PHPResponse } from '@php-wasm/universal';
import { createSpawnHandler, phpVar } from '@php-wasm/util';
import type {
	BlueprintBundle,
	BlueprintDeclaration,
	PHPExceptionDetails,
} from '@wp-playground/blueprints';
import { runBlueprintV2 } from '@wp-playground/blueprints';
import { bootRequestHandler } from '@wp-playground/wordpress';
import fs from 'fs';
import type { Server } from 'http';
import { PHPExecutionFailureError } from 'packages/php-wasm/universal/src/lib/php';
import { rootCertificates } from 'tls';
import { expandAutoMounts } from './cli-auto-mount';
import { mountResources, type Mount } from './mount';
import { ReportableError } from './reportable-error';
import { startServer } from './server';
import { resolveBlueprint } from './resolve-blueprint';
import { parseBlueprintDeclaration } from 'packages/playground/blueprints/src/lib/v2';

export interface RunCLIArgs {
	blueprint?: string | BlueprintDeclaration;
	blueprintMayReadAdjacentFiles?: boolean;
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

/**
 * Output writer that ensures that progress bars are not printed on the same line as other output.
 */
let output = {
	lastWriteWasProgress: false,
	progress(data: string) {
		if (!process.stdout.isTTY) {
			console.log(data);
		} else {
			if (!output.lastWriteWasProgress) {
				process.stdout.write('\n');
			}
			process.stdout.write('\r\x1b[K' + data);
			output.lastWriteWasProgress = true;
		}
	},
	stdout(data: string) {
		if (output.lastWriteWasProgress) {
			process.stdout.write('\n');
			output.lastWriteWasProgress = false;
		}
		process.stdout.write(data);
	},
	stderr(data: string) {
		if (output.lastWriteWasProgress) {
			process.stdout.write('\n');
			output.lastWriteWasProgress = false;
		}
		process.stderr.write(data);
	},
};

export async function runCLI(args: RunCLIArgs): Promise<RunCLIServer> {
	let phpErrorReported = false;

	try {
		/**
		 * Expand auto-mounts to include the necessary mounts and steps
		 * when running in auto-mount mode.
		 */
		if (args.autoMount) {
			args = expandAutoMounts(args);
		}

		// Store errors in memory. Logging all the errors is way too much noise.
		// Playground CLI curates the error output and only exposes all the errors
		// when the user specifically asks for it.
		if (!args.debug) {
			logger.handlers = [logToMemory];
		}

		if (args.quiet) {
			output = {
				lastWriteWasProgress: false,
				progress: () => {},
				stdout: () => {},
				stderr: () => {},
			};
		}

		let requestHandler: PHPRequestHandler;
		let wordPressReady = false;

		output.stdout('Starting a PHP server...\n');

		// @TODO: if args.php is missing, try to infer it from parsedBlueprintDeclaration
		return await startServer({
			port: args['port'] as number,
			onBind: async (
				server: Server,
				port: number
			): Promise<RunCLIServer> => {
				const absoluteUrl = `http://127.0.0.1:${port}`;

				output.stdout(`Booting the request handler\n`);
				requestHandler = await bootRequestHandler({
					siteUrl: absoluteUrl,
					createPhpRuntime: async () =>
						// Require the caller to specify the PHP version to avoid pre-emptive downloading of the Blueprint
						// file in TypeScript. PHP downloads the Blueprint, but before we can do that, we also need to know
						// which PHP version to use.
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

				const { php, reap } =
					await requestHandler.processManager.acquirePHPInstance();
				try {
					await runBlueprintV2({
						php,
						blueprint: args.blueprint,
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
								output.progress(message);
							},
							onError: (
								message,
								details?: PHPExceptionDetails
							) => {
								phpErrorReported = true;
								const red = '\x1b[31m';
								const bold = '\x1b[1m';
								const reset = '\x1b[0m';
								if (args.debug && details) {
									output.stderr(
										`${red}${bold}Fatal error:${reset} Uncaught ${details.exception}: ${details.message}\n` +
											`  at ${details.file}:${details.line}\n` +
											(details.trace
												? details.trace + '\n'
												: '')
									);
								} else {
									output.stderr(
										`${red}${bold}Error:${reset} ${message}\n`
									);
								}
							},
						},
					});
					wordPressReady = true;

					if (args.command === 'build-snapshot') {
						await zipDirectory(php, '/wordpress', '/tmp/build.zip');
						const zip = php.readFileAsBuffer('/tmp/build.zip');
						fs.writeFileSync(args.outfile as string, zip);
						php.unlink('/tmp/build.zip');

						output.stdout(
							`WordPress exported to ${args.outfile}\n`
						);
						process.exit(0);
					} else if (args.command === 'run-blueprint') {
						output.stdout(`Blueprint executed\n`);
						process.exit(0);
					} else {
						output.stdout(
							`WordPress is running on ${absoluteUrl}\n`
						);
					}

					return { requestHandler, server };
				} catch (error) {
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
	} catch (e) {
		/**
		 * @TODO: Consider printing errors stored in logger memory;
		 */
		const reportableCause = ReportableError.getReportableCause(e);
		if (reportableCause) {
			output.stdout(reportableCause.message);
			process.exit(1);
		} else if (e instanceof PHPExecutionFailureError) {
			// Avoid verbose error messages. Only print all the error details when:
			// * The user requested debug output
			// * The onError hook above did not report any error yet and the user cannot
			//   see any meaningful error message at this point
			if (args.debug || !phpErrorReported) {
				output.stderr(`--------------------------------\n`);
				output.stderr('Debug details:\n');
				output.stderr('--------------------------------\n');
				output.stderr(e.message);
				output.stderr(`\n\n==== PHP stderr ====\n\n`);
				output.stderr(e.response.errors);
				output.stderr(`\n\n==== PHP stdout ====\n\n`);
				output.stderr(e.response.text);
				output.stderr(`\n\n`);
				output.stderr(`--------------------------------\n`);
			}
			process.exit(1);
		} else {
			throw e;
		}
	}
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
				// logger.error('Error in childPHP:', e);
				if (e instanceof Error) {
					output.stderr(e.message);
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
