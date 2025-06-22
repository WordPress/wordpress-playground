import { errorLogPath, logger } from '@php-wasm/logger';
import { EmscriptenDownloadMonitor, ProgressTracker } from '@php-wasm/progress';
import type {
	PHPRequest,
	RemoteAPI,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import { consumeAPI, exposeAPI, PHPResponse } from '@php-wasm/universal';
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
	RecommendedPHPVersion,
	unzipFile,
	zipDirectory,
} from '@wp-playground/common';
import fs from 'fs';
import type { Server } from 'http';
import path from 'path';
import { Worker } from 'worker_threads';
// @ts-ignore
import importedWorkerUrlString from './worker-thread?worker&url';
import { expandAutoMounts } from './cli-auto-mount';
import {
	CACHE_FOLDER,
	cachedDownload,
	fetchSqliteIntegration,
	readAsFile,
} from './download';
import { startServer } from './server';
import { resolveWordPressRelease } from '@wp-playground/wordpress';
import type { PlaygroundCliWorker, Mount } from './worker-thread';
// @ts-ignore
import { FileLockManagerForNode } from '@php-wasm/node';
import { LoadBalancer } from './load-balancer';

export interface RunCLIArgs {
	blueprint?: BlueprintDeclaration | BlueprintBundle;
	command: 'server' | 'run-blueprint' | 'build-snapshot';
	debug?: boolean;
	login?: boolean;
	mount?: Mount[];
	mountBeforeInstall?: Mount[];
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

	async function compileInputBlueprint() {
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

	const compiledBlueprint = await compileInputBlueprint();

	// Declare file lock manager outside scope of startServer
	// so we can look at it when debugging request handling.
	const fileLockManager = new FileLockManagerForNode();

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
				const mountsBeforeWpInstall = args.mountBeforeInstall || [];
				const mountsAfterWpInstall = args.mount || [];

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
				});

				if (
					wpDetails &&
					!args.mountBeforeInstall &&
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
