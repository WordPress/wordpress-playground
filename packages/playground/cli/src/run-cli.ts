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
	StreamedPHPResponse,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import { PHPExecutionFailureError, PHPResponse } from '@php-wasm/universal';
import { createSpawnHandler, phpVar } from '@php-wasm/util';
import type {
	BlueprintDeclaration,
	PHPExceptionDetails,
} from '@wp-playground/blueprints';
import { runBlueprintV2 } from '@wp-playground/blueprints';
import { bootRequestHandler } from '@wp-playground/wordpress';
import fs from 'fs';
import type { Server } from 'http';
import { rootCertificates } from 'tls';
import { startServer } from './server';
/* eslint-disable no-console */
import { SupportedPHPVersions } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import yargs from 'yargs';
import {
	expandAutoMounts,
	mountResources,
	parseMountDirArguments,
	parseMountWithDelimiterArguments,
	type Mount,
} from './mounts';

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

export async function parseOptionsAndRunCLI() {
	/**
	 * @TODO This looks similar to Query API args https://wordpress.github.io/wordpress-playground/developers/apis/query-api/
	 *       Perhaps the two could be handled by the same code?
	 */
	const yargsObject = yargs(process.argv.slice(2))
		.usage('Usage: wp-playground <command> [options]')
		.positional('command', {
			describe: 'Command to run',
			choices: ['server', 'run-blueprint', 'build-snapshot'] as const,
			demandOption: true,
		})
		.option('outfile', {
			describe: 'When building, write to this output file.',
			type: 'string',
			default: 'wordpress.zip',
		})
		.option('port', {
			describe: 'Port to listen on when serving.',
			type: 'number',
			default: 9400,
		})
		.option('php', {
			describe: 'PHP version to use.',
			type: 'string',
			default: RecommendedPHPVersion,
			choices: SupportedPHPVersions,
		})
		.option('wp', {
			describe: 'WordPress version to use.',
			type: 'string',
			default: 'latest',
		})
		// @TODO: Support read-only mounts, e.g. via WORKERFS, a custom
		// ReadOnlyNODEFS, or by copying the files into MEMFS
		.option('mount', {
			describe:
				'Mount a directory to the PHP runtime. You can provide --mount multiple times. Format: /host/path:/vfs/path',
			type: 'array',
			string: true,
			coerce: parseMountWithDelimiterArguments,
		})
		.option('mountBeforeInstall', {
			describe:
				'Mount a directory to the PHP runtime before installing WordPress. You can provide --mount-before-install multiple times. Format: /host/path:/vfs/path',
			type: 'array',
			string: true,
			coerce: parseMountWithDelimiterArguments,
		})
		.option('mountDir', {
			describe:
				'Mount a directory to the PHP runtime. You can provide --mount-dir multiple times. Format: "/host/path" "/vfs/path"',
			type: 'array',
			nargs: 2,
			array: true,
			// coerce: parseMountDirArguments,
		})
		.option('mountDirBeforeInstall', {
			describe:
				'Mount a directory to the PHP runtime before installing WordPress. You can provide --mount-before-install multiple times. Format: "/host/path" "/vfs/path"',
			type: 'string',
			nargs: 2,
			array: true,
			coerce: parseMountDirArguments,
		})
		.option('login', {
			describe: 'Should log the user in',
			type: 'boolean',
			default: false,
		})
		.option('blueprint', {
			describe: 'Blueprint to execute.',
			type: 'string',
		})
		.option('blueprintMayReadAdjacentFiles', {
			describe:
				'Consent flag: Allow "bundled" resources in a local blueprint to read files in the same directory as the blueprint file.',
			type: 'boolean',
			default: false,
		})
		.option('skipWordPressSetup', {
			describe:
				'Do not download, unzip, and install WordPress. Useful for mounting a pre-configured WordPress directory at /wordpress.',
			type: 'boolean',
			default: false,
		})
		.option('skipSqliteSetup', {
			describe:
				'Skip the SQLite integration plugin setup to allow the WordPress site to use MySQL.',
			type: 'boolean',
			default: false,
		})
		.option('quiet', {
			describe: 'Do not output logs and progress messages.',
			type: 'boolean',
			default: false,
		})
		.option('debug', {
			describe:
				'Print PHP error log content if an error occurs during Playground boot.',
			type: 'boolean',
			default: false,
		})
		.option('autoMount', {
			describe: `Automatically mount the current working directory. You can mount a WordPress directory, a plugin directory, a theme directory, a wp-content directory, or any directory containing PHP and HTML files.`,
			type: 'boolean',
			default: false,
		})
		.option('followSymlinks', {
			describe:
				'Allow Playground to follow symlinks by automatically mounting symlinked directories and files encountered in mounted directories. \nWarning: Following symlinks will expose files outside mounted directories to Playground and could be a security risk.',
			type: 'boolean',
			default: false,
		})
		.showHelpOnFail(false);

	yargsObject.wrap(yargsObject.terminalWidth());
	const args = await yargsObject.argv;

	const command = args._[0] as string;

	if (!['run-blueprint', 'server', 'build-snapshot'].includes(command)) {
		yargsObject.showHelp();
		process.exit(1);
	}

	const cliArgs = {
		...args,
		command,
		mount: [...(args.mount || []), ...(args.mountDir || [])],
		mountBeforeInstall: [
			...(args.mountBeforeInstall || []),
			...(args.mountDirBeforeInstall || []),
		],
	} as RunCLIArgs;

	return await runCLI(cliArgs);
}

export async function runCLI(args: RunCLIArgs): Promise<RunCLIServer> {
	let phpErrorReported = false;

	let streamedResponse: StreamedPHPResponse | undefined;
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
				// Permanently lock primary PHP instance. Don't allow calling .cli() on
				// it as that would trash it.
				await requestHandler.processManager.acquirePHPInstance();

				console.log('primaryPHP acquired');

				const { php, reap } =
					await requestHandler.processManager.acquirePHPInstance();
				console.log('secondaryPHP acquired');
				try {
					streamedResponse = await runBlueprintV2({
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
					if (args.debug) {
						streamedResponse.stdout.pipeTo(
							new WritableStream({
								write(chunk) {
									process.stdout.write(chunk);
								},
							})
						);
						streamedResponse.stderr.pipeTo(
							new WritableStream({
								write(chunk) {
									process.stderr.write(chunk);
								},
							})
						);
					}
					await streamedResponse.finished;
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
					console.log('error!', error);
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
		console.log('error!', e);
		if (
			e instanceof PHPExecutionFailureError &&
			!args.debug &&
			phpErrorReported
		) {
			// We want to avoid verbose error messages.
			// Bale out if this is a known failure mode and we've already reported the error.
			process.exit(1);
		}

		if (streamedResponse) {
			// If we did not expect this error, print **all** the debug details we can get.
			output.stderr(`--------------------------------\n`);
			output.stderr('Debug details:\n');
			output.stderr('--------------------------------\n');
			if (e && typeof e === 'object' && 'message' in e) {
				output.stderr(e.message as string);
			}
			output.stderr(`\n\n==== PHP stderr ====\n\n`);
			if (streamedResponse) {
				output.stderr(await streamedResponse.stderrText);
			}

			output.stderr(`\n\n==== PHP stdout ====\n\n`);
			if (streamedResponse) {
				output.stderr(await streamedResponse.stdoutText);
			}
			output.stderr(`\n\n`);
			output.stderr(`--------------------------------\n`);
		}
		throw e;
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

/**
 * @TODO: Consider collapsing this spawn handler and @wp-playground/remote worker-utils.ts
 *        spawn handler into a single function
 */
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
			const { php, reap } = await processManager.acquirePHPInstance();

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
