/**
 * @TODO:
 * * Mount a stable system tmp or home/.playground-cli directory to store HTTP Cache.
 *   Flush stale entries periodically.
 * * Find a consistent logging interface. Right now we have a logger for some things and
 *   output.stdout for other things. In the browser, logger prints information to the
 *   devtools console which is only needed for debugging. The HTML makes for the UI.
 *   In CLI, the console and the UI are the same thing. Perhaps we actually need to
 *   separate what we print for UI reasons from what we print for debugging?
 */

import { errorLogPath, logger } from '@php-wasm/logger';
import { createNodeFsMountHandler, loadNodeRuntime } from '@php-wasm/node';
import type {
	PHP,
	PHPRequest,
	PHPRequestHandler,
	StreamedPHPResponse,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import {
	PHPExecutionFailureError,
	PHPResponse,
	sandboxedSpawnHandlerFactory,
} from '@php-wasm/universal';
import type {
	BlueprintDeclaration,
	PHPExceptionDetails,
	ParsedBlueprintV2Declaration,
} from '@wp-playground/blueprints';
import {
	parseBlueprintDeclaration,
	runBlueprintV2,
} from '@wp-playground/blueprints';
import { bootRequestHandler } from '@wp-playground/wordpress';
import fs, { existsSync } from 'fs';
import type { Server } from 'http';
import { rootCertificates } from 'tls';
import { startServer } from './server';
/* eslint-disable no-console */
import { SupportedPHPVersions } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import path from 'path';
import yargs from 'yargs';
import {
	expandAutoMounts,
	mountResources,
	parseMountDirArguments,
	parseMountWithDelimiterArguments,
	type Mount,
} from './mounts';

export interface RunCLIArgs {
	additionalBlueprintSteps?: any[];
	blueprint?: string | BlueprintDeclaration;
	command: 'server' | 'run-blueprint' | 'build-snapshot';
	debug?: boolean;
	login?: boolean;
	mount?: Mount[];
	mountBeforeInstall?: Mount[];
	outfile?: string;
	php: SupportedPHPVersion;
	port?: number;
	quiet?: boolean;
	wp?: string;
	'auto-mount'?: boolean;
	// Blueprint CLI options
	mode?: string;
	'db-engine'?: string;
	'db-host'?: string;
	'db-user'?: string;
	'db-pass'?: string;
	'db-name'?: string;
	'db-path'?: string;
	'truncate-new-site-directory'?: boolean;
	allow?: string;
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

		// Blueprints v2 CLI options
		.option('php', {
			describe:
				'PHP version to use. If Blueprint is provided, this option overrides the PHP version specified in the Blueprint.',
			type: 'string',
			choices: SupportedPHPVersions,
		})

		// Modifies the Blueprint:
		.option('wp', {
			describe:
				'WordPress version to use. If Blueprint is provided, this option overrides the WordPress version specified in the Blueprint.',
			type: 'string',
			default: 'latest',
			hidden: true,
		})
		.option('login', {
			describe:
				'Should log the user in. If Blueprint is provided, this option overrides the login specified in the Blueprint.',
			type: 'boolean',
			default: false,
			hidden: true,
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
			coerce: parseMountDirArguments,
		})
		.option('mountDirBeforeInstall', {
			describe:
				'Mount a directory to the PHP runtime before installing WordPress. You can provide --mount-before-install multiple times. Format: "/host/path" "/vfs/path"',
			type: 'string',
			nargs: 2,
			array: true,
			coerce: parseMountDirArguments,
		})
		.option('blueprint', {
			describe: 'Blueprint to execute.',
			type: 'string',
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
		.option('auto-mount', {
			describe: `Automatically mount the current working directory. You can mount a WordPress directory, a plugin directory, a theme directory, a wp-content directory, or any directory containing PHP and HTML files.`,
			type: 'boolean',
			default: false,
		})
		// Blueprint CLI options
		.option('mode', {
			describe: 'Execution mode',
			type: 'string',
			default: 'create-new-site',
			choices: [
				'create-new-site',
				'apply-to-existing-site',
				'mount-only',
			],
		})
		.option('db-engine', {
			describe: 'Database engine',
			type: 'string',
			default: 'sqlite',
			choices: ['mysql', 'sqlite'],
		})
		.option('db-host', {
			describe: 'MySQL host',
			type: 'string',
		})
		.option('db-user', {
			describe: 'MySQL user',
			type: 'string',
		})
		.option('db-pass', {
			describe: 'MySQL password',
			type: 'string',
		})
		.option('db-name', {
			describe: 'MySQL database',
			type: 'string',
		})
		.option('db-path', {
			describe: 'SQLite file path',
			type: 'string',
		})
		.option('truncate-new-site-directory', {
			describe: 'Delete target directory if it exists before execution',
			type: 'boolean',
		})
		.option('allow', {
			describe: 'Allowed permissions (comma-separated)',
			type: 'string',
			coerce: (value) => value.split(','),
			choices: ['bundled-files', 'follow-symlinks'],
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
		// Store errors in memory. Logging all the errors is way too much noise.
		// Playground CLI curates the error output and only exposes all the errors
		// when the user specifically asks for it.
		if (!args.debug) {
			// @TODO: Implement this
			// logger.handlers = [logToMemory];
		}

		if (args.quiet) {
			output = {
				lastWriteWasProgress: false,
				progress: () => {},
				stdout: () => {},
				stderr: () => {},
			};
		}

		/**
		 * Expand auto-mounts to include the necessary mounts and steps
		 * when running in auto-mount mode.
		 */
		if (args['auto-mount']) {
			args = expandAutoMounts(args);
		}

		let phpVersion = args.php;
		if (!phpVersion) {
			try {
				phpVersion = await inferPHP(args.blueprint);
			} catch (e) {
				if (e instanceof NonJsonBlueprintError) {
					output.stderr(
						`Could not determine the PHP version from the Blueprint. ` +
							`This usually happens if your Blueprint is not a plain JSON file ` +
							`(for example, if it's a ZIP, git repo, or another bundle format). ` +
							`Automatic PHP version detection only works for JSON blueprints. ` +
							`To continue, please specify the PHP version explicitly using the --php option (e.g. --php=8.2).`
					);
					throw e;
				} else if (e instanceof BlueprintReferenceError) {
					output.stderr(
						`Failed to load Blueprint: ${e.message}. ` +
							`Please check that the Blueprint path or URL is correct.`
					);
					throw e;
				} else if (e instanceof BlueprintParseError) {
					output.stderr(
						`Blueprint contains invalid JSON: ${e.parseError}. ` +
							`Please check the Blueprint syntax and try again.`
					);
					throw e;
				}

				// Generic inference failure
				throw new Error(
					`Failed to infer PHP version from Blueprint: ${
						e instanceof Error ? e.message : 'Unknown error'
					}. ` +
						`Please specify the PHP version explicitly using the --php option.`
				);
			}
		}

		let requestHandler: PHPRequestHandler;
		let wordPressReady = false;
		let isFirstRequest = true;

		output.stdout('Starting a PHP server...\n');

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
						await loadNodeRuntime(phpVersion, {
							followSymlinks:
								args.allow?.includes('follow-symlinks'),
							emscriptenOptions: {
								ENV: {
									DOCROOT: '/wordpress',
								},
							},
						}),
					sapiName: 'cli',
					createFiles: {
						'/internal/shared/ca-bundle.crt':
							rootCertificates.join('\n'),
					},
					phpIniEntries: {
						'openssl.cafile': '/internal/shared/ca-bundle.crt',
					},
					cookieStore: false,
					spawnHandler: (processManager) =>
						sandboxedSpawnHandlerFactory(processManager, {
							onError: (error) => {
								logger.error(error);
								output.stderr(`${error.message}\n`);
							},
						}),
				});

				const primaryPhp = await requestHandler.getPrimaryPhp();

				if (args.mountBeforeInstall) {
					await mountResources(primaryPhp, args.mountBeforeInstall);
				}

				// Mount the current working directory to the PHP runtime for the purposes of
				// Blueprint resolution.
				let unmountCwd = () => {};
				if (typeof args.blueprint === 'string') {
					const blueprintPath = path.resolve(
						process.cwd(),
						args.blueprint
					);
					if (existsSync(blueprintPath)) {
						primaryPhp.mkdir('/internal/shared/cwd');
						unmountCwd = await primaryPhp.mount(
							'/internal/shared/cwd',
							createNodeFsMountHandler(
								path.dirname(blueprintPath)
							)
						);
						args.blueprint = path.join(
							'/internal/shared/cwd',
							path.basename(args.blueprint)
						);
					}
				}

				const { php, reap } =
					await requestHandler.processManager.acquirePHPInstance({
						considerPrimary: false,
					});
				try {
					if (args.mode !== 'mount-only') {
						const cliArgsToPass: (keyof RunCLIArgs)[] = [
							'mode',
							'db-engine',
							'db-host',
							'db-user',
							'db-pass',
							'db-name',
							'db-path',
							'truncate-new-site-directory',
							'allow',
						];
						const cliArgs = cliArgsToPass
							.filter((arg) => arg in args)
							.map((arg) => `--${arg}=${args[arg]}`);
						cliArgs.push(`--site-url=${absoluteUrl}`);

						streamedResponse = await runBlueprintV2({
							php,
							blueprint: args.blueprint,
							blueprintOverrides: {
								additionalSteps: args.additionalBlueprintSteps,
								wordpressVersion: args.wp,
							},
							cliArgs,
							hooks: {
								afterBlueprintTargetResolved: async () => {
									await mountResources(
										primaryPhp,
										args.mount || []
									);
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
							streamedResponse!.stdout.pipeTo(
								new WritableStream({
									write(chunk) {
										process.stdout.write(chunk);
									},
								})
							);
							streamedResponse!.stderr.pipeTo(
								new WritableStream({
									write(chunk) {
										process.stderr.write(chunk);
									},
								})
							);
						}
						await streamedResponse!.finished;
						if ((await streamedResponse!.exitCode) !== 0) {
							throw new PHPExecutionFailureError(
								'Execution failed',
								await PHPResponse.fromStreamedResponse(
									streamedResponse
								),
								'request'
							);
						}
					} else {
						await mountResources(primaryPhp, args.mount || []);
					}
					wordPressReady = true;

					if (args.login) {
						php.defineConstant(
							'PLAYGROUND_AUTO_LOGIN_AS_USER',
							'admin'
						);
					}

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
					let phpLogs = '';
					try {
						phpLogs = php.readFileAsText(errorLogPath);
					} catch {
						phpLogs =
							'Unknown error – we could not even read the PHP error log.';
					}
					throw new Error(phpLogs, { cause: error });
				} finally {
					reap();
					unmountCwd();
				}
			},
			async handleRequest(request: PHPRequest) {
				if (!wordPressReady) {
					return PHPResponse.forHttpCode(
						502,
						'WordPress is not ready yet'
					);
				}

				// Clear the playground_auto_login_already_happened cookie on the first request.
				// Otherwise the first Playground CLI server started on the machine will set it,
				// all the subsequent runs will get the stale cookie, and the auto-login will
				// assume they don't have to auto-login again.
				if (isFirstRequest) {
					isFirstRequest = false;
					if (
						request.headers?.['cookie']?.includes(
							'playground_auto_login_already_happened'
						)
					) {
						return new PHPResponse(
							302,
							{
								'Set-Cookie': [
									'playground_auto_login_already_happened=1; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/',
								],
								'Content-Type': ['text/plain'],
								'Content-Length': ['0'],
								Location: ['/'],
							},
							new Uint8Array()
						);
					}
				}

				return await requestHandler.request(request);
			},
		});
	} catch (e) {
		if (
			e instanceof PHPExecutionFailureError &&
			!args.debug &&
			phpErrorReported
		) {
			// We want to avoid verbose error messages.
			// Bale out if this is a known failure mode and we've already reported the error.
			throw e;
		}

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

		throw e;
	}
}

/**
 * Infer the PHP version from the Blueprint declaration when the user
 * didn't explicitly provide --php. This needs to happen before we boot
 * the request handler so that we download / load the correct runtime.
 *
 * Ideally, we wouldn't need to reason about the Blueprint structure inside
 * TypeScript at all. We already have great PHP libraries for handling all that.
 * Unfortunately, we did not boot PHP yet. Even worse, we don't know which PHP
 * version we need to load yet.
 *
 * The code below duplicates the data resolution and Blueprint parsing logic
 * from the PHP Blueprint runner. We don't need it that much in CLI, since we
 * could just load any PHP version to parse the Blueprint and then load the
 * correct runtime. However, we will need it in the browser where downloading
 * PHP runtimes is expensive. We might as well implement it once and reuse it
 * in both places.
 *
 * ## Limitations
 *
 * * It can only handle JSON blueprints. Bundles (ZIP, git, etc.) are unsupported.
 *   The user must provide an explicit `--php=` version when using a bundle.
 *
 * @param blueprint The Blueprint declaration.
 * @returns The PHP version to use.
 */
async function inferPHP(blueprint: string | BlueprintDeclaration | undefined) {
	if (!blueprint) {
		return RecommendedPHPVersion;
	}
	/**
	 * Infer the PHP version from the Blueprint declaration when the user
	 * didn't explicitly provide --php. This needs to happen before we boot
	 * the request handler so that we download / load the correct runtime.
	 */
	const blueprintObject = await resolveBlueprintObject(
		parseBlueprintDeclaration(blueprint)
	);
	if (!blueprintObject || typeof blueprintObject !== 'object') {
		throw new Error('Blueprint is not a valid object');
	}

	let requestedPhp: any | string | undefined = undefined;
	/**
	 * We must, unfortunately, account for all possible versions of the Blueprint
	 * schema in here. The transpilation to the latest version only happens in the
	 * PHP code.
	 */
	requestedPhp =
		blueprintObject.phpVersion ??
		blueprintObject.preferredVersions?.php ??
		RecommendedPHPVersion;

	if (
		blueprintObject.phpVersion &&
		typeof blueprintObject.phpVersion === 'object'
	) {
		return (
			blueprintObject.phpVersion.recommended ||
			blueprintObject.phpVersion.max ||
			blueprintObject.phpVersion.min
		);
	} else if (typeof requestedPhp === 'string') {
		return requestedPhp as SupportedPHPVersion;
	} else {
		throw new Error('phpVersion is not a valid object or string');
	}
}

async function resolveBlueprintObject(
	declaration: ParsedBlueprintV2Declaration
): Promise<any> {
	if (declaration.type === 'inline-file') {
		try {
			return JSON.parse(declaration.contents);
		} catch (e) {
			throw new BlueprintParseError(
				`Failed to parse inline Blueprint JSON`,
				e instanceof Error ? e.message : 'Unknown JSON parse error'
			);
		}
	}
	if (declaration.type === 'file-reference') {
		const filePath = declaration.reference;
		const isUrl =
			filePath.startsWith('http://') || filePath.startsWith('https://');
		let contents: string;

		try {
			if (isUrl) {
				// @TODO: Respect HTTP cache in CLI.
				const response = await fetch(filePath);
				if (!response.ok) {
					throw new BlueprintReferenceError(
						`Failed to fetch Blueprint from URL (HTTP ${response.status})`,
						filePath,
						response.status
					);
				}
				contents = await response.text();
			} else {
				const resolvedPath = filePath.startsWith('/')
					? filePath
					: path.resolve(process.cwd(), filePath);

				if (!existsSync(resolvedPath)) {
					throw new BlueprintReferenceError(
						`Blueprint file not found`,
						resolvedPath
					);
				}

				try {
					contents = fs.readFileSync(resolvedPath, 'utf8');
				} catch (e) {
					if ((e as any).code === 'ENOENT') {
						throw new BlueprintReferenceError(
							`Blueprint file not found`,
							resolvedPath
						);
					}
					throw new BlueprintReferenceError(
						`Failed to read Blueprint file: ${
							(e as any).message || 'Unknown error'
						}`,
						resolvedPath
					);
				}
			}
		} catch (e) {
			// Re-throw our custom errors
			if (e instanceof BlueprintReferenceError) {
				throw e;
			}
			// Handle other network/fetch errors
			throw new BlueprintReferenceError(
				`Failed to load Blueprint: ${
					e instanceof Error ? e.message : 'Unknown error'
				}`,
				filePath
			);
		}

		try {
			return JSON.parse(contents);
		} catch (e) {
			// Check if this looks like a non-JSON file (ZIP, binary, etc.)
			if (
				contents.startsWith('PK') ||
				contents.includes('\x00') ||
				!contents.trim().startsWith('{')
			) {
				const detectedType = contents.startsWith('PK')
					? 'ZIP archive'
					: contents.includes('\x00')
					? 'binary file'
					: 'non-JSON text file';
				throw new NonJsonBlueprintError(
					`Blueprint appears to be a ${detectedType}, not a JSON file`,
					detectedType
				);
			}
			throw new BlueprintParseError(
				`Failed to parse Blueprint JSON from ${isUrl ? 'URL' : 'file'}`,
				e instanceof Error ? e.message : 'Unknown JSON parse error'
			);
		}
	}
	throw new NonJsonBlueprintError(
		`Unknown blueprint declaration type`,
		'unknown'
	);
}

/**
 * Custom error classes for blueprint resolution failures
 */
class NonJsonBlueprintError extends Error {
	constructor(message: string, public readonly blueprintType: string) {
		super(message);
		this.name = 'NonJsonBlueprintError';
	}
}

class BlueprintReferenceError extends Error {
	constructor(
		message: string,
		public readonly reference: string,
		public readonly statusCode?: number
	) {
		super(message);
		this.name = 'BlueprintReferenceError';
	}
}

class BlueprintParseError extends Error {
	constructor(message: string, public readonly parseError: string) {
		super(message);
		this.name = 'BlueprintParseError';
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
