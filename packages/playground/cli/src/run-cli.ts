import { errorLogPath, logger } from '@php-wasm/logger';
import { EmscriptenDownloadMonitor, ProgressTracker } from '@php-wasm/progress';
import type {
	PHPRequest,
	RemoteAPI,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import {
	PHPResponse,
	consumeAPI,
	exposeAPI,
	exposeSyncAPI,
} from '@php-wasm/universal';
import type {
	BlueprintBundle,
	BlueprintDeclaration,
} from '@wp-playground/blueprints';
import {
	compileBlueprint,
	isBlueprintBundle,
	runBlueprintSteps,
} from '@wp-playground/blueprints';
import {
	RecommendedPHPVersion,
	unzipFile,
	zipDirectory,
} from '@wp-playground/common';
import fs from 'fs';
import type { Server } from 'http';
import path from 'path';
import { Worker, MessageChannel } from 'worker_threads';
// @ts-ignore
import { resolveWordPressRelease } from '@wp-playground/wordpress';
import {
	expandAutoMounts,
	parseMountDirArguments,
	parseMountWithDelimiterArguments,
} from './mounts';
import {
	CACHE_FOLDER,
	cachedDownload,
	fetchSqliteIntegration,
	readAsFile,
} from './download';
import { startServer } from './server';
import type { Mount, PlaygroundCliWorker } from './worker-thread';
// @ts-ignore
import importedWorkerUrlString from './worker-thread?worker&url';
// @ts-ignore
import { FileLockManagerForNode } from '@php-wasm/node';
import { LoadBalancer } from './load-balancer';
/* eslint-disable no-console */
import { SupportedPHPVersions } from '@php-wasm/universal';
import { cpus } from 'os';
import { jspi } from 'wasm-feature-detect';
import type { MessagePort as NodeMessagePort } from 'worker_threads';
import yargs from 'yargs';
import { isValidWordPressSlug } from './is-valid-wordpress-slug';
import { ReportableError } from './reportable-error';
import { resolveBlueprint } from './resolve-blueprint';

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
				'Mount a directory to the PHP runtime (can be used multiple times). Format: /host/path:/vfs/path',
			type: 'array',
			string: true,
			coerce: parseMountWithDelimiterArguments,
		})
		.option('mount-before-install', {
			describe:
				'Mount a directory to the PHP runtime before WordPress installation (can be used multiple times). Format: /host/path:/vfs/path',
			type: 'array',
			string: true,
			coerce: parseMountWithDelimiterArguments,
		})
		.option('mount-dir', {
			describe:
				'Mount a directory to the PHP runtime (can be used multiple times). Format: "/host/path" "/vfs/path"',
			type: 'array',
			nargs: 2,
			array: true,
			// coerce: parseMountDirArguments,
		})
		.option('mount-dir-before-install', {
			describe:
				'Mount a directory before WordPress installation (can be used multiple times). Format: "/host/path" "/vfs/path"',
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
		.option('blueprint-may-read-adjacent-files', {
			describe:
				'Consent flag: Allow "bundled" resources in a local blueprint to read files in the same directory as the blueprint file.',
			type: 'boolean',
			default: false,
		})
		.option('skip-wordpress-setup', {
			describe:
				'Do not download, unzip, and install WordPress. Useful for mounting a pre-configured WordPress directory at /wordpress.',
			type: 'boolean',
			default: false,
		})
		.option('skip-sqlite-setup', {
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
		.option('auto-mount', {
			describe: `Automatically mount the current working directory. You can mount a WordPress directory, a plugin directory, a theme directory, a wp-content directory, or any directory containing PHP and HTML files.`,
			type: 'boolean',
			default: false,
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
		.option('internal-cookie-store', {
			describe:
				'Enable internal cookie handling. When enabled, Playground will manage cookies internally using ' +
				'an HttpCookieStore that persists cookies across requests. When disabled, cookies are handled ' +
				'externally (e.g., by a browser in Node.js environments).',
			type: 'boolean',
			default: false,
		})
		.option('xdebug', {
			describe: 'Enable Xdebug.',
			type: 'boolean',
			default: false,
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

				const isMountingWordPressDir = (mount: Mount) =>
					mount.vfsPath === '/wordpress';
				if (
					!args.mount?.some(isMountingWordPressDir) &&
					!(args['mount-before-install'] as any)?.some(
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
		blueprint: await resolveBlueprint({
			sourceString: args.blueprint,
			blueprintMayReadAdjacentFiles: args.blueprintMayReadAdjacentFiles,
		}),
		mount: [...(args.mount || []), ...(args['mount-dir'] || [])],
		'mount-before-install': [
			...(args['mount-before-install'] || []),
			...(args['mount-dir-before-install'] || []),
		],
	} as RunCLIArgs;

	try {
		return runCLI(cliArgs);
	} catch (e) {
		const reportableCause = ReportableError.getReportableCause(e);
		if (reportableCause) {
			console.log('');
			console.log(reportableCause.message);
			process.exit(1);
		} else {
			throw e;
		}
	}
}

export interface RunCLIArgs {
	blueprint?: BlueprintDeclaration | BlueprintBundle;
	command: 'server' | 'run-blueprint' | 'build-snapshot';
	debug?: boolean;
	login?: boolean;
	mount?: Mount[];
	'mount-before-install'?: Mount[];
	outfile?: string;
	php?: SupportedPHPVersion;
	port?: number;
	quiet?: boolean;
	skipWordPressSetup?: boolean;
	skipSqliteSetup?: boolean;
	wp?: string;
	autoMount?: boolean;
	followSymlinks?: boolean;
	experimentalMultiWorker?: number;
	experimentalTrace?: boolean;
	internalCookieStore?: boolean;
	'additional-blueprint-steps'?: any[];
	xdebug?: boolean;
}

export interface RunCLIServer extends AsyncDisposable {
	playground: RemoteAPI<PlaygroundCliWorker>;
	server: Server;
	[Symbol.asyncDispose](): Promise<void>;
}

export async function runCLI(args: RunCLIArgs): Promise<RunCLIServer> {
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
	if (args.autoMount) {
		args = expandAutoMounts(args);
	}

	/**
	 * TODO: This exact feature will be provided in the PHP Blueprints library.
	 *       Let's use it when it ships. Let's also use it in the web Playground
	 *       app.
	 */
	async function zipSite(outfile: string) {
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

	async function compileInputBlueprint(additionalBlueprintSteps: any[]) {
		/**
		 * @TODO This looks similar to the resolveBlueprint() call in the website package:
		 * 	     https://github.com/WordPress/wordpress-playground/blob/ce586059e5885d185376184fdd2f52335cca32b0/packages/playground/website/src/main.tsx#L41
		 *
		 * 		 Also the Blueprint Builder tool does something similar.
		 *       Perhaps all these cases could be handled by the same function?
		 */
		const blueprint: BlueprintDeclaration | BlueprintBundle =
			isBlueprintBundle(args.blueprint)
				? args.blueprint
				: {
						login: args.login,
						...args.blueprint,
						preferredVersions: {
							php:
								args.php ??
								args?.blueprint?.preferredVersions?.php ??
								RecommendedPHPVersion,
							wp:
								args.wp ??
								args?.blueprint?.preferredVersions?.wp ??
								'latest',
							...(args.blueprint?.preferredVersions || {}),
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
				writeProgressUpdate(
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

	let lastProgressMessage = '';
	function writeProgressUpdate(
		writeStream: NodeJS.WriteStream,
		message: string,
		finalUpdate: boolean
	) {
		if (message === lastProgressMessage) {
			// Avoid repeating the same message
			return;
		}
		lastProgressMessage = message;

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

	/**
	 * Spawns a new Worker Thread.
	 *
	 * @param  workerUrl The absolute URL of the worker script.
	 * @returns The spawned Worker Thread.
	 */
	async function spawnPHPWorkerThread(workerUrl: URL) {
		const worker = new Worker(workerUrl);

		return new Promise<{ worker: Worker; phpPort: NodeMessagePort }>(
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
						`Worker failed to load at ${workerUrl}. ${
							e.message ? `Original error: ${e.message}` : ''
						}`
					);
					(error as any).filename = workerUrl;
					reject(error);
				});
			}
		);
	}

	function spawnWorkerThreads(
		count: number
	): Promise<{ worker: Worker; phpPort: NodeMessagePort }[]> {
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

	const compiledBlueprint = await compileInputBlueprint(
		args['additional-blueprint-steps'] || []
	);

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

	/**
	 * Expose the file lock manager API on a MessagePort and return it.
	 *
	 * @see comlink-sync.ts
	 * @see phpwasm-emscripten-library-file-locking-for-node.js
	 */
	async function exposeFileLockManager() {
		const { port1, port2 } = new MessageChannel();
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

	let wordPressReady = false;

	logger.log('Starting a PHP server...');

	return startServer({
		port: args['port'] as number,
		onBind: async (server: Server, port: number): Promise<RunCLIServer> => {
			const absoluteUrl = `http://127.0.0.1:${port}`;

			// Kick off worker threads now to save time later.
			// There is no need to wait for other async processes to complete.
			const totalWorkerCount = args.experimentalMultiWorker ?? 1;
			const promisedWorkers = spawnWorkerThreads(totalWorkerCount);

			logger.log(`Setting up WordPress ${args.wp}`);
			let wpDetails: any = undefined;
			// @TODO: Rename to FetchProgressMonitor. There's nothing Emscripten
			// about that class anymore.
			const monitor = new EmscriptenDownloadMonitor();
			if (!args.skipWordPressSetup) {
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

					if (!args.quiet) {
						writeProgressUpdate(
							process.stdout,
							`Downloading WordPress ${percentProgress}%...`,
							progressReached100
						);
					}
				}) as any);

				wpDetails = await resolveWordPressRelease(args.wp);
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
			const sqliteIntegrationPluginZip = args.skipSqliteSetup
				? undefined
				: await fetchSqliteIntegration(monitor);

			const followSymlinks = args.followSymlinks === true;
			const trace = args.experimentalTrace === true;
			try {
				const mountsBeforeWpInstall =
					args['mount-before-install'] || [];
				const mountsAfterWpInstall = args.mount || [];

				const [initialWorker, ...additionalWorkers] =
					await promisedWorkers;

				playground = consumeAPI<PlaygroundCliWorker>(
					initialWorker.phpPort
				);
				playgroundsToCleanUp.push({
					playground,
					worker: initialWorker.worker,
				});

				// Comlink communication proxy
				await playground.isConnected();

				const fileLockManagerPort = await exposeFileLockManager();

				logger.log(`Booting WordPress...`);

				// Each additional worker needs a separate process ID space
				// for file locking to work properly because locks are associated
				// with individual processes. To accommodate this, we split the safe
				// integers into a range for each worker.
				const processIdSpaceLength = Math.floor(
					Number.MAX_SAFE_INTEGER / totalWorkerCount
				);

				await playground.useFileLockManager(fileLockManagerPort);
				await playground.boot({
					phpVersion: compiledBlueprint.versions.php,
					wpVersion: compiledBlueprint.versions.wp,
					absoluteUrl,
					mountsBeforeWpInstall,
					mountsAfterWpInstall,
					wordPressZip:
						wordPressZip && (await wordPressZip!.arrayBuffer()),
					sqliteIntegrationPluginZip:
						await sqliteIntegrationPluginZip!.arrayBuffer(),
					firstProcessId: 0,
					processIdSpaceLength,
					followSymlinks,
					trace,
					internalCookieStore: args.internalCookieStore,
					withXdebug: args.xdebug,
				});

				if (
					wpDetails &&
					!args['mount-before-install'] &&
					!fs.existsSync(preinstalledWpContentPath)
				) {
					logger.log(
						`Caching preinstalled WordPress for the next boot...`
					);
					fs.writeFileSync(
						preinstalledWpContentPath,
						await zipDirectory(playground, '/wordpress')
					);
					logger.log(`Cached!`);
				}

				loadBalancer = new LoadBalancer(playground);

				await playground.isReady();
				wordPressReady = true;
				logger.log(`Booted!`);

				if (compiledBlueprint) {
					logger.log(`Running the Blueprint...`);
					await runBlueprintSteps(compiledBlueprint, playground);
					logger.log(`Finished running the blueprint`);
				}

				if (args.command === 'build-snapshot') {
					await zipSite(args.outfile as string);
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
					);

					// Boot additional workers
					const initialWorkerProcessIdSpace = processIdSpaceLength;
					await Promise.all(
						additionalWorkers.map(async (worker, index) => {
							const additionalPlayground =
								consumeAPI<PlaygroundCliWorker>(worker.phpPort);
							playgroundsToCleanUp.push({
								playground: additionalPlayground,
								worker: worker.worker,
							});

							await additionalPlayground.isConnected();

							const firstProcessId =
								initialWorkerProcessIdSpace +
								index * processIdSpaceLength;

							const fileLockManagerPort =
								await exposeFileLockManager();
							await additionalPlayground.useFileLockManager(
								fileLockManagerPort
							);
							await additionalPlayground.boot({
								phpVersion: compiledBlueprint.versions.php,
								absoluteUrl,
								mountsBeforeWpInstall,
								mountsAfterWpInstall,
								// Skip WordPress zip because we share the /wordpress directory
								// populated by the initial worker.
								wordPressZip: undefined,
								// Skip SQLite integration plugin for now because we
								// will copy it from primary's `/internal` directory.
								sqliteIntegrationPluginZip: undefined,
								dataSqlPath:
									'/wordpress/wp-content/database/.ht.sqlite',
								firstProcessId,
								processIdSpaceLength,
								followSymlinks,
								trace,
								internalCookieStore: args.internalCookieStore,
								withXdebug: args.xdebug,
							});
							await additionalPlayground.isReady();

							// Replicate the Blueprint-initialized /internal directory
							await additionalPlayground.writeFile(
								'/tmp/internal.zip',
								internalZip
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

				logger.log(`WordPress is running on ${absoluteUrl}`);

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
						await new Promise((resolve) => server.close(resolve));
					},
				};
			} catch (error) {
				if (!args.debug) {
					throw error;
				}
				const phpLogs = await playground.readFileAsText(errorLogPath);
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
			return await loadBalancer.handleRequest(request);
		},
	});
}
