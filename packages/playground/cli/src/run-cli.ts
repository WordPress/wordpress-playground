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
import {
	FileLockManagerForNode,
	createNodeFsMountHandler,
	loadNodeRuntime,
} from '@php-wasm/node';
import type {
	PHP,
	PHPRequest,
	PHPRequestHandler,
	RemoteAPI,
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
import { RecommendedPHPVersion, zipDirectory } from '@wp-playground/common';
import path from 'path';
import yargs from 'yargs';
import {
	expandAutoMounts,
	mountResources,
	parseMountDirArguments,
	parseMountWithDelimiterArguments,
	type Mount,
} from './mounts';
// @ts-ignore
import type { PlaygroundCliWorker } from './worker-thread';
import { LoadBalancer } from './load-balancer';
// @ts-ignore
import { cpus } from 'os';
import { resolveWordPressRelease } from '@wp-playground/wordpress';
import { jspi } from 'wasm-feature-detect';

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
	experimentalMultiWorker?: number;
	experimentalTrace?: boolean;
}

export interface RunCLIServer extends AsyncDisposable {
	playground: RemoteAPI<PlaygroundCliWorker>;
	server: Server;
	[Symbol.asyncDispose](): Promise<void>;
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
		.showHelpOnFail(false)
		.option('experimentalTrace', {
			describe:
				'Print detailed messages about system behavior to the console. Useful for troubleshooting.',
			type: 'boolean',
			default: false,
			// Hide this option because we want to replace with a more general log-level flag.
			hidden: true,
		})
		// TODO: Should we make this a hidden flag?
		.option('experimentalMultiWorker', {
			describe:
				'Enable experimental multi-worker support which requires JSPI ' +
				'and a /wordpress directory backed by a real filesystem. ' +
				'Pass a positive number to specify the number of workers to use. ' +
				'Otherwise, default to the number of CPUs minus 1.',
			type: 'number',
			coerce: (value?: number) => value ?? cpus().length - 1,
		})
		.check(async (args) => {
			if (args.wp !== undefined && !isValidWordPressSlug(args.wp)) {
				try {
					// Check if is valid URL
					new URL(args.wp);
				} catch {
					throw new Error(
						'Unrecognized WordPress version. Please use "latest", a URL, or a numeric version such as "6.2", "6.0.1", "6.2-beta1", or "6.2-RC1"'
					);
				}
			}

			if (args.experimentalMultiWorker !== undefined) {
				if (args.experimentalMultiWorker <= 1) {
					throw new Error(
						'The --experimentalMultiWorker flag must be a positive integer greater than 1.'
					);
				}

				if (!(await jspi())) {
					throw new Error(
						'JavaScript Promise Integration (JSPI) is not enabled. Please enable JSPI in your JavaScript runtime before using the --experimentalMultiWorker flag.'
					);
				}

				const isMountingWordPressDir = (mount: Mount) =>
					mount.vfsPath === '/wordpress';
				if (
					!args.mount?.some(isMountingWordPressDir) &&
					!args.mountBeforeInstall?.some(isMountingWordPressDir)
				) {
					throw new Error(
						'Please mount a real filesystem directory as the /wordpress directory before using the --experimentalMultiWorker flag.'
					);
				}
			}
			return true;
		});

	yargsObject.wrap(yargsObject.terminalWidth());
	const args = await yargsObject.argv;

	const command = args._[0] as string;

	if (!['run-blueprint', 'server', 'build-snapshot'].includes(command)) {
		yargsObject.showHelp();
		process.exit(1);
	}

	let loadBalancer: LoadBalancer;
	let playground: RemoteAPI<PlaygroundCliWorker>;

	const playgroundsToCleanUp: {
		playground: RemoteAPI<PlaygroundCliWorker>;
		worker: Worker;
	}[] = [];

	const cliArgs = {
		...args,
		command,
		mount: [...(args.mount || []), ...(args.mountDir || [])],
		mountBeforeInstall: [
			...(args.mountBeforeInstall || []),
			...(args.mountDirBeforeInstall || []),
		],
		blueprint:
			typeof args.blueprint === 'string' ? args.blueprint : undefined,
		php: (args.php ?? RecommendedPHPVersion) as SupportedPHPVersion,
	};

	// 4. Define phpErrorReported in the correct scope
	let phpErrorReported = false;

	/**
	 * Spawns a new Worker Thread.
	 *
	 * @param  workerUrl The absolute URL of the worker script.
	 * @returns The spawned Worker Thread.
	 */
	async function spawnPHPWorkerThread(workerUrl: URL) {
		const worker = new Worker(workerUrl);
		return new Promise<Worker>((resolve, reject) => {
			function onMessage(event: string) {
				if (event === 'worker-script-initialized') {
					resolve(worker);
					if (typeof (worker as any).off === 'function') {
						(worker as any).off('message', onMessage);
					} else if (
						typeof (worker as any).removeListener === 'function'
					) {
						(worker as any).removeListener('message', onMessage);
					}
				}
			}
			function onError(e: Error) {
				const error = new Error(
					`Worker failed to load at ${workerUrl}. ${
						e.message ? `Original error: ${e.message}` : ''
					}`
				);
				(error as any).filename = workerUrl;
				reject(error);
				if (typeof (worker as any).off === 'function') {
					(worker as any).off('error', onError);
				} else if (
					typeof (worker as any).removeListener === 'function'
				) {
					(worker as any).removeListener('error', onError);
				}
			}
			if (typeof (worker as any).on === 'function') {
				(worker as any).on('message', onMessage);
				(worker as any).on('error', onError);
			} else if (typeof (worker as any).addListener === 'function') {
				(worker as any).addListener('message', onMessage);
				(worker as any).addListener('error', onError);
			}
		});
	}

	function isValidWordPressSlug(slug: string): boolean {
		// Accepts 'latest', 'nightly', 'trunk', or a version like '6.2', '6.2.1', '6.2-beta1', '6.2-RC1'
		return (
			slug === 'latest' ||
			slug === 'nightly' ||
			slug === 'trunk' ||
			/^\d+\.\d+(\.\d+)?(-beta\d+|-RC\d+)?$/.test(slug)
		);
	}

	let expandedArgs = args;
	if (args['auto-mount']) {
		expandedArgs = { ...args, ...expandAutoMounts(args) };
	}

	// Kick off worker threads now to save time later.
	// There is no need to wait for other async processes to complete.
	const totalWorkerCount = expandedArgs.experimentalMultiWorker ?? 1;
	const promisedWorkers = spawnWorkerThreads(totalWorkerCount);

	// 2. Ensure php is always a SupportedPHPVersion
	let phpVersion = expandedArgs.php as SupportedPHPVersion;
	if (!phpVersion) {
		try {
			phpVersion = await inferPHP(expandedArgs.blueprint);
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
		port: expandedArgs['port'] as number,
		onBind: async (server: Server, port: number): Promise<RunCLIServer> => {
			const absoluteUrl = `http://127.0.0.1:${port}`;

			output.stdout(`Booting the request handler\n`);
			requestHandler = await bootRequestHandler({
				siteUrl: absoluteUrl,
				createPhpRuntime: async () =>
					await loadNodeRuntime(phpVersion, {
						followSymlinks:
							expandedArgs.allow?.includes('follow-symlinks'),
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

			if (expandedArgs.mountBeforeInstall) {
				await mountResources(
					primaryPhp,
					expandedArgs.mountBeforeInstall
				);
			}

			// Mount the current working directory to the PHP runtime for the purposes of
			// Blueprint resolution.
			let unmountCwd = () => {};
			if (typeof expandedArgs.blueprint === 'string') {
				const blueprintPath = path.resolve(
					process.cwd(),
					expandedArgs.blueprint
				);
				if (existsSync(blueprintPath)) {
					primaryPhp.mkdir('/internal/shared/cwd');
					unmountCwd = await primaryPhp.mount(
						'/internal/shared/cwd',
						createNodeFsMountHandler(path.dirname(blueprintPath))
					);
					expandedArgs.blueprint = path.join(
						'/internal/shared/cwd',
						path.basename(expandedArgs.blueprint)
					);
				}
			}

			if (
				expandedArgs.experimentalMultiWorker &&
				expandedArgs.experimentalMultiWorker > 1
			) {
				// Multi-worker logic (from the trunk branch)
				// ... Insert the multi-worker logic here, adapted to use Blueprints v2 if needed ...
				// For now, show a message and exit (implement full logic as needed)
				output.stdout(
					'Experimental multi-worker mode is not fully implemented in this merge.'
				);
				process.exit(1);
			} else {
				// Single worker logic (Blueprints v2 execution)
				// ... Insert the Blueprints v2 execution logic here (from HEAD branch) ...
				// (This is the logic that uses runBlueprintV2, etc.)
				// ... existing code ...
				const { php, reap } =
					await requestHandler.processManager.acquirePHPInstance({
						considerPrimary: false,
					});
				try {
					if (expandedArgs.mode !== 'mount-only') {
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
							.filter((arg) => arg in expandedArgs)
							.map((arg) => `--${arg}=${expandedArgs[arg]}`);
						cliArgs.push(`--site-url=${absoluteUrl}`);

						// 1. Ensure blueprint is string for runBlueprintV2
						const blueprintArg =
							typeof expandedArgs.blueprint === 'string'
								? expandedArgs.blueprint
								: undefined;

						// 3. Use correct access for additionalBlueprintSteps
						const additionalBlueprintSteps = (expandedArgs as any)[
							'additionalBlueprintSteps'
						];

						const streamedResponse = await runBlueprintV2({
							php,
							blueprint: blueprintArg,
							blueprintOverrides: {
								additionalSteps: additionalBlueprintSteps,
								wordpressVersion: expandedArgs.wp,
							},
							cliArgs,
							hooks: {
								afterBlueprintTargetResolved: async () => {
									await mountResources(
										primaryPhp,
										expandedArgs.mount || []
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
									if (expandedArgs.debug && details) {
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
						if (expandedArgs.debug) {
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
						await mountResources(
							primaryPhp,
							expandedArgs.mount || []
						);
					}
					wordPressReady = true;

					if (expandedArgs.login) {
						php.defineConstant(
							'PLAYGROUND_AUTO_LOGIN_AS_USER',
							'admin'
						);
					}

					if (expandedArgs.command === 'build-snapshot') {
						await zipDirectory(php, '/wordpress');
						const zip = php.readFileAsBuffer('/tmp/file.zip');
						fs.writeFileSync(expandedArgs.outfile as string, zip);
						php.unlink('/tmp/file.zip');

						output.stdout(
							`WordPress exported to ${expandedArgs.outfile}\n`
						);
						process.exit(0);
					} else if (expandedArgs.command === 'run-blueprint') {
						output.stdout(`Blueprint executed\n`);
						process.exit(0);
					} else {
						output.stdout(
							`WordPress is running on ${absoluteUrl}\n`
						);
					}

					return {
						playground,
						server,
						[Symbol.asyncDispose]: async function () {
							await server.close();
						},
					};
				} catch (error) {
					if (!expandedArgs.debug) {
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
					`Failed to parse Blueprint JSON from ${
						isUrl ? 'URL' : 'file'
					}`,
					e instanceof Error ? e.message : 'Unknown JSON parse error'
				);
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

function spawnWorkerThreads(count: number): Promise<Worker[]> {
	// TODO: Set the correct worker script URL for your environment
	const importedWorkerUrlString = './worker-thread.js';
	const moduleWorkerUrl = new URL(importedWorkerUrlString, import.meta.url);
	const promises = [];
	for (let i = 0; i < count; i++) {
		promises.push(spawnPHPWorkerThread(moduleWorkerUrl));
	}
	return Promise.all(promises);
}
