import { errorLogPath, logger } from '@php-wasm/logger';
import type {
	PHPRequest,
	RemoteAPI,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import {
	consumeAPI,
	exposeAPI,
	exposeSyncAPI,
	PHPResponse,
	printDebugDetails,
	SupportedPHPVersions,
} from '@php-wasm/universal';
import {
	compileBlueprint,
	type CompiledBlueprint,
	isBlueprintBundle,
	type BlueprintBundle,
	type BlueprintDeclaration,
} from '@wp-playground/blueprints';
import {
	RecommendedPHPVersion,
	unzipFile,
	zipDirectory,
} from '@wp-playground/common';
import fs from 'fs';
import { cpus } from 'os';
import { jspi } from 'wasm-feature-detect';
import yargs from 'yargs';
import { isValidWordPressSlug } from './is-valid-wordpress-slug';
import { ReportableError } from './reportable-error';
// @ts-ignore
import importedWorkerV1UrlString from './worker-thread-v1?worker&url';
// @ts-ignore
import {
	Worker,
	MessageChannel as NodeMessageChannel,
	type MessagePort as NodeMessagePort,
} from 'worker_threads';
import {
	expandAutoMounts,
	parseMountDirArguments,
	parseMountWithDelimiterArguments,
	type Mount,
} from './mounts';
import { resolveBlueprint } from './resolve-blueprint';

import { FileLockManagerForNode } from '@php-wasm/node';
import { EmscriptenDownloadMonitor, ProgressTracker } from '@php-wasm/progress';
import { resolveWordPressRelease } from '@wp-playground/wordpress';
import type { Server } from 'http';
import path from 'path';
import {
	CACHE_FOLDER,
	cachedDownload,
	fetchSqliteIntegration,
	readAsFile,
} from './download';
import { LoadBalancer } from './load-balancer';
import { startServer } from './server';
import type { PlaygroundCliBlueprintV1Worker } from './worker-thread-v1';
import type { PlaygroundCliBlueprintV2Worker } from './worker-thread-v2';

/* eslint-disable no-console */
export interface RunCLIArgs {
	'additional-blueprint-steps'?: any[];
	blueprint?: string | BlueprintDeclaration | BlueprintBundle;
	command: 'server' | 'run-blueprint' | 'build-snapshot';
	debug?: boolean;
	login?: boolean;
	mount?: Mount[];
	'mount-before-install'?: Mount[];
	outfile?: string;
	php?: SupportedPHPVersion;
	port?: number;
	quiet?: boolean;
	wp?: string;
	'auto-mount'?: boolean;

	'experimental-multi-worker'?: number;
	'experimental-trace'?: boolean;
	'blueprint-version'?: 'v1' | 'v2' | 'auto';

	// v1-specific options (hidden from help but supported for backward compatibility)
	'skip-wordpress-setup'?: boolean;
	'skip-sqlite-setup'?: boolean;
	'internal-cookie-store'?: boolean;
	'blueprint-may-read-adjacent-files'?: boolean;
	'follow-symlinks'?: boolean;

	// v2-specific options
	mode?: string;
	'db-engine'?: string;
	'db-host'?: string;
	'db-user'?: string;
	'db-pass'?: string;
	'db-name'?: string;
	'db-path'?: string;
	'truncate-new-site-directory'?: boolean;
	allow?: string[];
}

export async function parseOptionsAndRunCLI() {
	let cliArgs: RunCLIArgs | undefined = undefined;
	try {
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

			// Blueprints CLI options
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
			})
			.option('login', {
				describe:
					'Should log the user in. If Blueprint is provided, this option overrides the login specified in the Blueprint.',
				type: 'boolean',
				default: false,
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
			.option('mount-before-install', {
				describe:
					'Mount a directory to the PHP runtime before installing WordPress. You can provide --mount-before-install multiple times. Format: /host/path:/vfs/path',
				type: 'array',
				string: true,
				coerce: parseMountWithDelimiterArguments,
			})
			.option('mount-dir', {
				describe:
					'Mount a directory to the PHP runtime. You can provide --mount-dir multiple times. Format: "/host/path" "/vfs/path"',
				type: 'array',
				nargs: 2,
				array: true,
				coerce: parseMountDirArguments,
			})
			.option('mount-dir-before-install', {
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
			.option('internal-cookie-store', {
				describe:
					'Enable internal cookie handling. When enabled, Playground will manage cookies internally using ' +
					'an HttpCookieStore that persists cookies across requests. When disabled, cookies are handled ' +
					'externally (e.g., by a browser in Node.js environments).',
				type: 'boolean',
				default: false,
			})

			// Blueprint version selection
			.option('blueprint-version', {
				describe: 'Blueprint version to use (auto-detected by default)',
				type: 'string',
				choices: ['v1', 'v2', 'auto'],
				default: 'auto',
			})

			// v2-specific Blueprint CLI options
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
				describe:
					'Delete target directory if it exists before execution',
				type: 'boolean',
			})
			.option('allow', {
				describe: 'Allowed permissions (comma-separated)',
				type: 'string',
				coerce: (value) => value?.split(','),
				choices: ['bundled-files', 'follow-symlinks'],
			})
			.option('experimental-trace', {
				describe:
					'Print detailed messages about system behavior to the console. Useful for troubleshooting.',
				type: 'boolean',
				default: false,
				// Hide this option because we want to replace with a more general log-level flag.
				hidden: true,
			})
			// TODO: Should we make this a hidden flag?
			.option('experimental-multi-worker', {
				describe:
					'Enable experimental multi-worker support which requires JSPI ' +
					'and a /wordpress directory backed by a real filesystem. ' +
					'Pass a positive number to specify the number of workers to use. ' +
					'Otherwise, default to the number of CPUs minus 1.',
				type: 'number',
				coerce: (value?: number) => value ?? cpus().length - 1,
			})

			// Legacy options, specific to Blueprints v1 (BC reasons only, they're hidden from
			// the help message).
			.option('skip-wordpress-setup', {
				describe:
					'Do not download, unzip, and install WordPress. Useful for mounting a pre-configured WordPress directory at /wordpress.',
				type: 'boolean',
				default: false,
				hidden: true,
			})
			.option('skip-sqlite-setup', {
				describe:
					'Skip the SQLite integration plugin setup to allow the WordPress site to use MySQL.',
				type: 'boolean',
				default: false,
				hidden: true,
			})
			.option('blueprint-may-read-adjacent-files', {
				describe:
					'Consent flag: Allow "bundled" resources in a local blueprint to read files in the same directory as the blueprint file.',
				type: 'boolean',
				default: false,
				hidden: true,
			})
			.option('follow-symlinks', {
				describe:
					'Allow Playground to follow symlinks by automatically mounting symlinked directories and files encountered in mounted directories. \nWarning: Following symlinks will expose files outside mounted directories to Playground and could be a security risk.',
				type: 'boolean',
				default: false,
			})

			// Backward compatibility aliases (hidden)
			.option('experimentalMultiWorker', {
				type: 'number',
				hidden: true,
				coerce: (value?: number) => value ?? cpus().length - 1,
			})
			.option('experimentalTrace', {
				type: 'boolean',
				hidden: true,
			})
			.option('blueprintMayReadAdjacentFiles', {
				type: 'boolean',
				hidden: true,
			})
			.option('skipWordPressSetup', {
				type: 'boolean',
				hidden: true,
			})
			.option('skipSqliteSetup', {
				type: 'boolean',
				hidden: true,
			})
			.option('internalCookieStore', {
				type: 'boolean',
				hidden: true,
			})
			.option('followSymlinks', {
				type: 'boolean',
				hidden: true,
			})
			.option('autoMount', {
				type: 'boolean',
				hidden: true,
			})

			.showHelpOnFail(false)
			.check(async (args) => {
				// Normalize camelCase to kebab-case for backward compatibility
				if (args.experimentalMultiWorker !== undefined) {
					args['experimental-multi-worker'] =
						args.experimentalMultiWorker;
				}
				if (args.experimentalTrace !== undefined) {
					args['experimental-trace'] = args.experimentalTrace;
				}
				if (args.blueprintMayReadAdjacentFiles !== undefined) {
					args['blueprint-may-read-adjacent-files'] =
						args.blueprintMayReadAdjacentFiles;
				}
				if (args.skipWordPressSetup !== undefined) {
					args['skip-wordpress-setup'] = args.skipWordPressSetup;
				}
				if (args.skipSqliteSetup !== undefined) {
					args['skip-sqlite-setup'] = args.skipSqliteSetup;
				}
				if (args.internalCookieStore !== undefined) {
					args['internal-cookie-store'] = args.internalCookieStore;
				}
				if (args.followSymlinks !== undefined) {
					args['follow-symlinks'] = args.followSymlinks;
				}
				if (args.autoMount !== undefined) {
					args['auto-mount'] = args.autoMount;
				}

				// Convert V1 arguments to V2 arguments
				if (!args['allow']) {
					args['allow'] = [];
				}

				if (args['follow-symlinks']) {
					args['allow'].push('follow-symlinks');
				}

				if (args['blueprint-may-read-adjacent-files']) {
					args['allow'].push('bundled-files');
				}

				if (args['skip-sqlite-setup']) {
					args['db-engine'] = 'apply-to-existing-site';
				}

				if (args['skip-wordpress-setup']) {
					args['mode'] = 'mount-only';
				}

				// Validation
				if (args.wp !== undefined && !isValidWordPressSlug(args.wp)) {
					try {
						// Check if is valid URL
						new URL(args.wp);
					} catch {
						const message =
							'Unrecognized WordPress version. Please use "latest", a URL, or a numeric version such as "6.2", "6.0.1", "6.2-beta1", or "6.2-RC1"';
						console.error(message);
						throw new Error(message);
					}
				}

				if (args['experimental-multi-worker'] !== undefined) {
					if (args['experimental-multi-worker'] <= 1) {
						const message =
							'The --experimental-multi-worker flag must be a positive integer greater than 1.';
						console.error(message);
						throw new Error(message);
					}

					if (!(await jspi())) {
						const message =
							'JavaScript Promise Integration (JSPI) is not enabled. Please enable JSPI in your JavaScript runtime before using the --experimental-multi-worker flag. In Node.js, you can use the --experimental-wasm-jspi flag.';
						console.error(message);
						throw new Error(message);
					}

					const isMountingWordPressDir = (mount: Mount) =>
						mount.vfsPath === '/wordpress';
					if (
						!args.mount?.some(isMountingWordPressDir) &&
						!(args['mount-before-install'] as any)?.some(
							isMountingWordPressDir
						)
					) {
						const message =
							'Please mount a real filesystem directory as the /wordpress directory before using the --experimental-multi-worker flag.';
						console.error(message);
						throw new Error(message);
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

		cliArgs = {
			...args,
			command,
			mount: [...(args.mount || []), ...(args.mountDir || [])],
			'mount-before-install': [
				...(args['mount-before-install'] || []),
				...(args['mount-dir-before-install'] || []),
			],
		} as RunCLIArgs;

		return await runCLI(cliArgs);
	} catch (e) {
		if (cliArgs?.debug) {
			await printDebugDetails(e, (e as any)?.streamedResponse);
		}

		const reportableCause = ReportableError.getReportableCause(e);
		if (reportableCause) {
			console.log('');
			console.log(reportableCause.message);
			process.exit(1);
		} else {
			// If we did not expect this error, print **all** the debug details we can get.
			throw e;
		}
	}
}

export interface RunCLIServer extends AsyncDisposable {
	playground:
		| RemoteAPI<PlaygroundCliBlueprintV1Worker>
		| RemoteAPI<PlaygroundCliBlueprintV2Worker>;
	server: Server;
	[Symbol.asyncDispose](): Promise<void>;
}

export async function runCLI(args: RunCLIArgs): Promise<RunCLIServer> {
	let loadBalancer: LoadBalancer | undefined = undefined;

	const playgroundsToCleanUp: {
		playground: { dispose: () => Promise<void> };
		worker: Worker;
	}[] = [];

	/**
	 * Expand auto-mounts to include the necessary mounts and steps
	 * when running in auto-mount mode.
	 */
	if (args['auto-mount']) {
		args = expandAutoMounts(args);
	}

	if (args.quiet) {
		// @ts-ignore
		logger.handlers = [];
	}

	// Declare file lock manager outside scope of startServer
	// so we can look at it when debugging request handling.
	const nativeFlockSync = await import('fs-ext')
		.then((m) => m.flockSync)
		.catch(() => {
			logger.warn(
				'The fs-ext package is not installed. ' +
					'Internal file locking will not be integrated with ' +
					'host OS file locking.'
			);
			return undefined;
		});

	const fileLockManager = new FileLockManagerForNode(nativeFlockSync);
	const fileLockManagerPort = await exposeFileLockManager(fileLockManager);

	logger.log('Starting a PHP server...');

	const totalWorkerCount = args['experimental-multi-worker'] ?? 1;
	// Each additional worker needs a separate process ID space
	// for file locking to work properly because locks are associated
	// with individual processes. To accommodate this, we split the safe
	// integers into a range for each worker.
	const processIdSpaceLength = Math.floor(
		Number.MAX_SAFE_INTEGER / totalWorkerCount
	);

	let primaryPlayground:
		| RemoteAPI<PlaygroundCliBlueprintV1Worker>
		| undefined = undefined;
	let wordPressReady = false;

	return startServer({
		port: args['port'] as number,
		onBind: async (server: Server, port: number) => {
			const siteUrl = `http://127.0.0.1:${port}`;
			const handler = new BlueprintsV1Handler(args, {
				siteUrl,
				processIdSpaceLength,
			});

			const [initialWorker, ...additionalWorkers] =
				await spawnWorkerThreads(
					importedWorkerV1UrlString,
					totalWorkerCount
				);

			try {
				logger.log(`Setting up WordPress ${args.wp}`);

				primaryPlayground = await handler.bootPrimaryWorker(
					initialWorker.phpPort,
					fileLockManagerPort
				);
				playgroundsToCleanUp.push({
					playground: primaryPlayground,
					worker: initialWorker.worker,
				});

				loadBalancer = new LoadBalancer(primaryPlayground);

				if (args.command === 'build-snapshot') {
					await zipSite(primaryPlayground, args.outfile as string);
					logger.log(`WordPress exported to ${args.outfile}`);
					process.exit(0);
				} else if (args.command === 'run-blueprint') {
					logger.log(`Blueprint executed`);
					process.exit(0);
				}

				if (totalWorkerCount > 1) {
					logger.log(`Preparing additional workers...`);

					// Save /internal directory from initial worker so we can replicate it
					// in each additional worker.
					const internalZip = await zipDirectory(
						primaryPlayground,
						'/internal'
					);

					// Boot additional workers
					const initialWorkerProcessIdSpace = processIdSpaceLength;
					await Promise.all(
						additionalWorkers.map(async (spawnedWorker, index) => {
							const firstProcessId =
								initialWorkerProcessIdSpace +
								index * processIdSpaceLength;

							const fileLockManagerPort =
								await exposeFileLockManager(fileLockManager);

							const additionalPlayground =
								await handler.bootSecondaryWorker({
									worker: spawnedWorker,
									fileLockManagerPort,
									firstProcessId,
								});
							playgroundsToCleanUp.push({
								playground: additionalPlayground,
								worker: spawnedWorker.worker,
							});

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

							loadBalancer!.addWorker(additionalPlayground);
						})
					);

					logger.log(`Ready!`);
				}

				logger.log(`WordPress is running on ${siteUrl}`);
				wordPressReady = true;

				return {
					playground: primaryPlayground,
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
						await new Promise((resolve) => server.close(resolve));
					},
				};
			} catch (error) {
				if (!args.debug) {
					throw error;
				}
				const phpLogs =
					(await primaryPlayground?.readFileAsText(errorLogPath)) ||
					'<no logs available>';
				throw new Error(phpLogs, { cause: error });
			}
		},
		async handleRequest(request: PHPRequest) {
			if (!wordPressReady || !loadBalancer) {
				return PHPResponse.forHttpCode(
					502,
					'WordPress is not ready yet'
				);
			}
			return await loadBalancer.handleRequest(request);
		},
	});
}

/**
 * Boots Playground CLI workers using Blueprint version 1.
 *
 * Progress tracking, downloads, steps, and all other features are
 * implemented in TypeScript and orchestrated by this class.
 */
class BlueprintsV1Handler {
	private phpVersion: SupportedPHPVersion | undefined;
	private lastProgressMessage = '';

	private siteUrl: string;
	private processIdSpaceLength: number;
	private args: RunCLIArgs;

	constructor(
		args: RunCLIArgs,
		options: {
			siteUrl: string;
			processIdSpaceLength: number;
		}
	) {
		this.args = args;
		this.siteUrl = options.siteUrl;
		this.processIdSpaceLength = options.processIdSpaceLength;
	}

	getWorkerUrl() {
		return importedWorkerV1UrlString;
	}

	async bootPrimaryWorker(
		phpPort: NodeMessagePort,
		fileLockManagerPort: NodeMessagePort
	) {
		const compiledBlueprint = await this.compileInputBlueprint(
			this.args['additional-blueprint-steps'] || []
		);
		this.phpVersion = compiledBlueprint.versions.php;

		let wpDetails: any = undefined;
		// @TODO: Rename to FetchProgressMonitor. There's nothing Emscripten
		// about that class anymore.
		const monitor = new EmscriptenDownloadMonitor();
		if (!this.args['skip-wordpress-setup']) {
			let progressReached100 = false;
			monitor.addEventListener('progress', ((
				e: CustomEvent<ProgressEvent & { finished: boolean }>
			) => {
				if (progressReached100) {
					return;
				}

				// @TODO Every progress bar will want percentages. The
				//       download monitor should just provide that.
				const { loaded, total } = e.detail;
				// Use floor() so we don't report 100% until truly there.
				const percentProgress = Math.floor(
					Math.min(100, (100 * loaded) / total)
				);
				progressReached100 = percentProgress === 100;

				if (!this.args.quiet) {
					this.writeProgressUpdate(
						process.stdout,
						`Downloading WordPress ${percentProgress}%...`,
						progressReached100
					);
				}
			}) as any);

			wpDetails = await resolveWordPressRelease(this.args.wp);
			logger.log(
				`Resolved WordPress release URL: ${wpDetails?.releaseUrl}`
			);
		}

		const preinstalledWpContentPath =
			wpDetails &&
			path.join(
				CACHE_FOLDER,
				`prebuilt-wp-content-for-wp-${wpDetails.version}.zip`
			);
		const wordPressZip = !wpDetails
			? undefined
			: fs.existsSync(preinstalledWpContentPath)
			? readAsFile(preinstalledWpContentPath)
			: await cachedDownload(
					wpDetails.releaseUrl,
					`${wpDetails.version}.zip`,
					monitor
			  );

		logger.log(`Fetching SQLite integration plugin...`);
		const sqliteIntegrationPluginZip = this.args['skip-sqlite-setup']
			? undefined
			: await fetchSqliteIntegration(monitor);

		const followSymlinks =
			this.args.allow?.includes('follow-symlinks') === true;
		const trace = this.args['experimental-trace'] === true;

		const mountsBeforeWpInstall = this.args['mount-before-install'] || [];
		const mountsAfterWpInstall = this.args.mount || [];

		const playground = consumeAPI<PlaygroundCliBlueprintV1Worker>(phpPort);

		// Comlink communication proxy
		await playground.isConnected();

		logger.log(`Booting WordPress...`);

		await playground.useFileLockManager(fileLockManagerPort);
		await playground.boot({
			phpVersion: this.phpVersion,
			wpVersion: compiledBlueprint.versions.wp,
			absoluteUrl: this.siteUrl,
			mountsBeforeWpInstall,
			mountsAfterWpInstall,
			wordPressZip: wordPressZip && (await wordPressZip!.arrayBuffer()),
			sqliteIntegrationPluginZip:
				await sqliteIntegrationPluginZip!.arrayBuffer(),
			firstProcessId: 0,
			processIdSpaceLength: this.processIdSpaceLength,
			followSymlinks,
			trace,
			internalCookieStore: this.args['internal-cookie-store'],
		});

		if (
			wpDetails &&
			!this.args['mount-before-install'] &&
			!fs.existsSync(preinstalledWpContentPath)
		) {
			logger.log(`Caching preinstalled WordPress for the next boot...`);
			fs.writeFileSync(
				preinstalledWpContentPath,
				(await zipDirectory(playground, '/wordpress'))!
			);
			logger.log(`Cached!`);
		}

		return playground;
	}

	async bootSecondaryWorker({
		worker,
		fileLockManagerPort,
		firstProcessId,
	}: {
		worker: SpawnedWorker;
		fileLockManagerPort: NodeMessagePort;
		firstProcessId: number;
	}) {
		const additionalPlayground = consumeAPI<PlaygroundCliBlueprintV1Worker>(
			worker.phpPort
		);

		await additionalPlayground.isConnected();
		await additionalPlayground.useFileLockManager(fileLockManagerPort);
		await additionalPlayground.boot({
			phpVersion: this.phpVersion,
			absoluteUrl: this.siteUrl,
			mountsBeforeWpInstall: this.args['mount-before-install'] || [],
			mountsAfterWpInstall: this.args['mount'] || [],
			// Skip WordPress zip because we share the /wordpress directory
			// populated by the initial worker.
			wordPressZip: undefined,
			// Skip SQLite integration plugin for now because we
			// will copy it from primary's `/internal` directory.
			sqliteIntegrationPluginZip: undefined,
			dataSqlPath: '/wordpress/wp-content/database/.ht.sqlite',
			firstProcessId,
			processIdSpaceLength: this.processIdSpaceLength,
			followSymlinks:
				this.args['allow']?.includes('follow-symlinks') === true,
			trace: this.args['experimental-trace'] === true,
			// @TODO: Move this to the request handler or else every worker
			//        will have a separate cookie store.
			internalCookieStore: this.args['internal-cookie-store'],
		});
		await additionalPlayground.isReady();
		return additionalPlayground;
	}

	async compileInputBlueprint(additionalBlueprintSteps: any[]) {
		const args = this.args;
		const resolvedBlueprint =
			typeof args.blueprint === 'string'
				? await resolveBlueprint({
						sourceString: args.blueprint,
						blueprintMayReadAdjacentFiles:
							args['allow']?.includes(
								'blueprint-may-read-adjacent-files'
							) === true,
				  })
				: (args.blueprint as BlueprintDeclaration);
		/**
		 * @TODO This looks similar to the resolveBlueprint() call in the website package:
		 * 	     https://github.com/WordPress/wordpress-playground/blob/ce586059e5885d185376184fdd2f52335cca32b0/packages/playground/website/src/main.tsx#L41
		 *
		 * 		 Also the Blueprint Builder tool does something similar.
		 *       Perhaps all these cases could be handled by the same function?
		 */
		const blueprint: BlueprintDeclaration | BlueprintBundle =
			isBlueprintBundle(resolvedBlueprint)
				? resolvedBlueprint
				: {
						login: args.login,
						...(resolvedBlueprint || {}),
						preferredVersions: {
							php:
								args.php ??
								resolvedBlueprint?.preferredVersions?.php ??
								RecommendedPHPVersion,
							wp:
								args.wp ??
								resolvedBlueprint?.preferredVersions?.wp ??
								'latest',
							...(resolvedBlueprint?.preferredVersions || {}),
						},
				  };

		const tracker = new ProgressTracker();
		let lastCaption = '';
		let progressReached100 = false;
		tracker.addEventListener('progress', (e: any) => {
			if (progressReached100) {
				return;
			}
			progressReached100 = e.detail.progress === 100;

			// Use floor() so we don't report 100% until truly there.
			const progressInteger = Math.floor(e.detail.progress);
			lastCaption =
				e.detail.caption || lastCaption || 'Running the Blueprint';
			const message = `${lastCaption.trim()} – ${progressInteger}%`;
			if (!args.quiet) {
				this.writeProgressUpdate(
					process.stdout,
					message,
					progressReached100
				);
			}
		});
		return await compileBlueprint(blueprint as BlueprintDeclaration, {
			progress: tracker,
			additionalSteps: additionalBlueprintSteps,
		});
	}

	writeProgressUpdate(
		writeStream: NodeJS.WriteStream,
		message: string,
		finalUpdate: boolean
	) {
		if (message === this.lastProgressMessage) {
			// Avoid repeating the same message
			return;
		}
		this.lastProgressMessage = message;

		if (writeStream.isTTY) {
			// Overwrite previous progress updates in-place for a quieter UX.
			writeStream.cursorTo(0);
			writeStream.write(message);
			writeStream.clearLine(1);

			if (finalUpdate) {
				writeStream.write('\n');
			}
		} else {
			// Fall back to writing one line per progress update
			writeStream.write(`${message}\n`);
		}
	}
}

type SpawnedWorker = {
	worker: Worker;
	phpPort: NodeMessagePort;
};
function spawnWorkerThreads(
	workerUrlString: string,
	count: number
): Promise<SpawnedWorker[]> {
	const moduleWorkerUrl = new URL(workerUrlString, import.meta.url);

	const promises = [];
	for (let i = 0; i < count; i++) {
		const worker = new Worker(moduleWorkerUrl);
		const onExit: (code: number) => void = (code: number) => {
			if (code === 0) {
				return;
			}
			process.stderr.write(`Worker ${i} exited with code ${code}\n`);
			// If the primary worker crashes, exit the entire process.
			if (i === 0) {
				process.exit(1);
			}
		};
		promises.push(
			new Promise<{ worker: Worker; phpPort: NodeMessagePort }>(
				(resolve, reject) => {
					worker.once('message', function (message: any) {
						// Let the worker confirm it has initialized.
						// We could use the 'online' event to detect start of JS execution,
						// but that would miss initialization errors.
						if (message.command === 'worker-script-initialized') {
							resolve({ worker, phpPort: message.phpPort });
						}
					});
					worker.once('error', function (e: Error) {
						console.error(e);
						const error = new Error(
							`Worker failed to load at ${moduleWorkerUrl}. ${
								e.message ? `Original error: ${e.message}` : ''
							}`
						);
						(error as any).filename = moduleWorkerUrl;
						reject(error);
					});
					worker.once('exit', onExit);
				}
			)
		);
	}
	return Promise.all(promises);
}

/**
 * Expose the file lock manager API on a MessagePort and return it.
 *
 * @see comlink-sync.ts
 * @see phpwasm-emscripten-library-file-locking-for-node.js
 */
async function exposeFileLockManager(fileLockManager: FileLockManagerForNode) {
	const { port1, port2 } = new NodeMessageChannel();
	if (await jspi()) {
		/**
		 * When JSPI is available, the worker thread expects an asynchronous API.
		 *
		 * @see worker-thread.ts
		 * @see comlink-sync.ts
		 * @see phpwasm-emscripten-library-file-locking-for-node.js
		 */
		exposeAPI(fileLockManager, null, port1);
	} else {
		/**
		 * When JSPI is not available, the worker thread expects a synchronous API.
		 *
		 * @see worker-thread.ts
		 * @see comlink-sync.ts
		 * @see phpwasm-emscripten-library-file-locking-for-node.js
		 */
		await exposeSyncAPI(fileLockManager, port1);
	}
	return port2;
}

async function zipSite(
	playground: RemoteAPI<PlaygroundCliBlueprintV1Worker>,
	outfile: string
) {
	await playground.run({
		code: `<?php
		$zip = new ZipArchive();
		if(false === $zip->open('/tmp/build.zip', ZipArchive::CREATE | ZipArchive::OVERWRITE)) {
			throw new Exception('Failed to create ZIP');
		}
		$files = new RecursiveIteratorIterator(
			new RecursiveDirectoryIterator('/wordpress')
		);
		foreach ($files as $file) {
			echo $file . PHP_EOL;
			if (!$file->isFile()) {
				continue;
			}
			$zip->addFile($file->getPathname(), $file->getPathname());
		}
		$zip->close();

	`,
	});
	const zip = await playground.readFileAsBuffer('/tmp/build.zip');
	fs.writeFileSync(outfile, zip);
}
