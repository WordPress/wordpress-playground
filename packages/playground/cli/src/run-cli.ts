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
import type {
	PHPRequest,
	RemoteAPI,
	StreamedPHPResponse,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import {
	PHPExecutionFailureError,
	PHPResponse,
	SupportedPHPVersions,
	consumeAPI,
	exposeAPI,
} from '@php-wasm/universal';
import type {
	BlueprintDeclaration,
	ParsedBlueprintV2Declaration,
} from '@wp-playground/blueprints';
import { parseBlueprintDeclaration } from '@wp-playground/blueprints';
import {
	RecommendedPHPVersion,
	unzipFile,
	zipDirectory,
} from '@wp-playground/common';
import fs, { existsSync } from 'fs';
import type { Server } from 'http';
import path from 'path';
import { Worker } from 'worker_threads';
import yargs from 'yargs';
// @ts-ignore
import { expandAutoMounts } from './mounts';
import { startServer } from './server';
import type { PlaygroundCliWorker } from './worker-thread';
// @ts-ignore
import importedWorkerUrlString from './worker-thread?worker&url';
// @ts-ignore
import { FileLockManagerForNode } from '@php-wasm/node';
import { LoadBalancer } from './load-balancer';
import {
	parseMountDirArguments,
	parseMountWithDelimiterArguments,
	type Mount,
} from './mounts';

/* eslint-disable no-console */
import { cpus } from 'os';
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
		.option('follow-symlinks', {
			describe:
				'Allow Playground to follow symlinks by automatically mounting symlinked directories and files encountered in mounted directories. \nWarning: Following symlinks will expose files outside mounted directories to Playground and could be a security risk.',
			type: 'boolean',
			default: false,
		})
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
		.showHelpOnFail(false)
		.check(async (args) => {
			if (args.experimentalMultiWorker !== undefined) {
				if (args.experimentalMultiWorker <= 1) {
					throw new Error(
						'The --experimentalMultiWorker flag must be a positive integer greater than 1.'
					);
				}

				if (!(await jspi())) {
					throw new Error(
						'JavaScript Promise Integration (JSPI) is not enabled. Please enable JSPI in your JavaScript runtime before using the --experimentalMultiWorker flag. In Node.js, you can use the --experimental-wasm-jspi flag.'
					);
				}

				const isMountingWordPressDir = (mount: Mount) =>
					mount.vfsPath === '/wordpress';
				if (
					!args.mount?.some(isMountingWordPressDir) &&
					!(args['mountBeforeInstall'] as any)?.some(
						isMountingWordPressDir
					)
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

export interface RunCLIServer extends AsyncDisposable {
	playground: RemoteAPI<PlaygroundCliWorker>;
	server: Server;
	[Symbol.asyncDispose](): Promise<void>;
}

export async function runCLI(args: RunCLIArgs): Promise<RunCLIServer> {
	// @TODO: We lost track of phpErrorReported with multiple workers. How
	//        should we handle it?
	// @TODO: Preserve cwd when booting workers.
	let phpErrorReported = false;
	let streamedResponse: StreamedPHPResponse | undefined;

	try {
		let loadBalancer: LoadBalancer;
		let playground: RemoteAPI<PlaygroundCliWorker>;

		const playgroundsToCleanUp: {
			playground: RemoteAPI<PlaygroundCliWorker>;
			worker: Worker;
		}[] = [];

		/**
		 * Expand auto-mounts to include the necessary mounts and steps
		 * when running in auto-mount mode.
		 */
		if (args['auto-mount']) {
			args = expandAutoMounts(args);
		}

		const phpVersion = args.php || (await inferPHP(args.blueprint));
		let wordPressReady = false;
		let isFirstRequest = true;

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
					// Let the worker confirm it has initialized.
					// We could use the 'online' event to detect start of JS execution,
					// but that would miss initialization errors.
					if (event === 'worker-script-initialized') {
						resolve(worker);
						worker.off('message', onMessage);
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
					worker.off('error', onError);
				}
				worker.on('message', onMessage);
				worker.on('error', onError);
			});
		}

		function spawnWorkerThreads(count: number): Promise<Worker[]> {
			const moduleWorkerUrl = new URL(
				importedWorkerUrlString,
				import.meta.url
			);

			const promises = [];
			for (let i = 0; i < count; i++) {
				promises.push(spawnPHPWorkerThread(moduleWorkerUrl));
			}
			return Promise.all(promises);
		}

		if (args.quiet) {
			// @ts-ignore
			logger.handlers = [];
		}

		// Declare file lock manager outside scope of startServer
		// so we can look at it when debugging request handling.
		const fileLockManager = new FileLockManagerForNode();

		logger.log('Starting a PHP server...');

		return startServer({
			port: args['port'] as number,
			onBind: async (
				server: Server,
				port: number
			): Promise<RunCLIServer> => {
				const siteUrl = `http://127.0.0.1:${port}`;

				// Kick off worker threads now to save time later.
				// There is no need to wait for other async processes to complete.
				const totalWorkerCount = args.experimentalMultiWorker ?? 1;
				const promisedWorkers = spawnWorkerThreads(totalWorkerCount);

				logger.log(`Setting up WordPress ${args.wp}`);

				const trace = args.experimentalTrace === true;
				try {
					const [initialWorker, ...additionalWorkers] =
						await promisedWorkers;

					playground = consumeAPI<PlaygroundCliWorker>(initialWorker);
					playgroundsToCleanUp.push({
						playground,
						worker: initialWorker,
					});

					await playground.isConnected();

					exposeAPI(fileLockManager, undefined, initialWorker);

					logger.log(`Booting WordPress...`);

					// Each additional worker needs a separate process ID space
					// for file locking to work properly because locks are associated
					// with individual processes. To accommodate this, we split the safe
					// integers into a range for each worker.
					const processIdSpaceLength = Math.floor(
						Number.MAX_SAFE_INTEGER / totalWorkerCount
					);

					await playground.bootAsPrimaryWorker({
						...args,
						php: phpVersion,
						siteUrl,
						firstProcessId: 0,
						processIdSpaceLength,
						trace,
					});

					if (args.login) {
						// @TODO: Do we need this in all the workers? Or just in the primary one?
						//        Are we sharing constants between workers?
						await playground.defineConstant(
							'PLAYGROUND_AUTO_LOGIN_AS_USER',
							'admin'
						);
					}

					loadBalancer = new LoadBalancer(playground);

					await playground.isReady();
					wordPressReady = true;
					logger.log(`Booted!`);

					if (args.command === 'build-snapshot') {
						await zipDirectory(
							playground,
							'/wordpress',
							args.outfile as string
						);
						logger.log(`WordPress exported to ${args.outfile}`);
						process.exit(0);
					} else if (args.command === 'run-blueprint') {
						logger.log(`Blueprint executed`);
						process.exit(0);
					}

					if (
						args.experimentalMultiWorker &&
						args.experimentalMultiWorker > 1
					) {
						logger.log(`Preparing additional workers...`);

						// Save /internal directory from initial worker so we can replicate it
						// in each additional worker.
						const internalZip = await zipDirectory(
							playground,
							'/internal'
						)!;

						// Boot additional workers
						const initialWorkerProcessIdSpace =
							processIdSpaceLength;
						await Promise.all(
							additionalWorkers.map(async (worker, index) => {
								const additionalPlayground =
									consumeAPI<PlaygroundCliWorker>(worker);
								playgroundsToCleanUp.push({
									playground: additionalPlayground,
									worker,
								});

								await additionalPlayground.isConnected();
								exposeAPI(fileLockManager, undefined, worker);

								const firstProcessId =
									initialWorkerProcessIdSpace +
									index * processIdSpaceLength;

								await additionalPlayground.bootAsSecondaryWorker(
									{
										...args,
										php: phpVersion,
										siteUrl,
										firstProcessId,
										processIdSpaceLength,
										trace,
									}
								);
								await additionalPlayground.isReady();

								// Replicate the Blueprint-initialized /internal directory
								await additionalPlayground.writeFile(
									'/tmp/internal.zip',
									internalZip!
								);
								await unzipFile(
									additionalPlayground,
									'/tmp/internal.zip',
									'/internal'
								);
								await additionalPlayground.unlink(
									'/tmp/internal.zip'
								);

								loadBalancer.addWorker(additionalPlayground);
							})
						);

						logger.log(`Ready!`);
					}

					logger.log(`WordPress is running on ${siteUrl}`);

					return {
						playground,
						server,
						[Symbol.asyncDispose]: async function disposeCLI() {
							await Promise.all(
								playgroundsToCleanUp.map(
									async ({ playground, worker }) => {
										await playground.dispose();
										await worker.terminate();
									}
								)
							);
							await new Promise((resolve) =>
								server.close(resolve)
							);
						},
					};
				} catch (error) {
					// @TODO: Without this console.log, the error is not reported
					console.error('error', error);
					if (!args.debug) {
						throw error;
					}
					let phpLogs = '';
					try {
						// @TODO: Don't assume errorLogPath starts with /wordpress/
						//        ...or maybe we can assume that in Playground CLI?
						phpLogs = await playground.readFileAsText(errorLogPath);
					} catch {
						phpLogs =
							'Unknown error. Even the PHP error log is not available to source more details.';
					}
					throw new Error(phpLogs, { cause: error });
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

				return await loadBalancer.handleRequest(request);
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
	try {
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
	public readonly blueprintType: string;

	constructor(message: string, blueprintType: string) {
		super(message);
		this.name = 'NonJsonBlueprintError';
		this.blueprintType = blueprintType;
	}
}

class BlueprintReferenceError extends Error {
	public readonly reference: string;
	public readonly statusCode?: number;

	constructor(message: string, reference: string, statusCode?: number) {
		super(message);
		this.name = 'BlueprintReferenceError';
		this.reference = reference;
		this.statusCode = statusCode;
	}
}

class BlueprintParseError extends Error {
	public readonly parseError: string;

	constructor(message: string, parseError: string) {
		super(message);
		this.name = 'BlueprintParseError';
		this.parseError = parseError;
	}
}
