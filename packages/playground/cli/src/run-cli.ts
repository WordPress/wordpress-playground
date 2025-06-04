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
import { rootCertificates } from 'tls';
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
import moduleWorkerUrlString from './worker-thread?worker&url';
import { FileLockManagerForNode } from '@php-wasm/node';

export interface RunCLIArgs {
	blueprint?: BlueprintDeclaration | BlueprintBundle;
	command: 'server' | 'run-blueprint' | 'build-snapshot';
	debug?: boolean;
	login?: boolean;
	mount?: string[];
	mountBeforeInstall?: string[];
	outfile?: string;
	php?: SupportedPHPVersion;
	port?: number;
	quiet?: boolean;
	skipWordPressSetup?: boolean;
	skipSqliteSetup?: boolean;
	wp?: string;
	autoMount?: boolean;
	followSymlinks?: boolean;
}

export interface RunCLIServer {
	// TODO: Create interface over multiple workers?
	playground: RemoteAPI<PlaygroundCliWorker>;
	server: Server;
}

// TODO: Restore this to a Promise for RunCLIServer?
export async function runCLI(args: RunCLIArgs): Promise<RunCLIServer> {
	let loadBalancer: LoadBalancer;
	// TODO: Consider direct reference to primary playground. Does this make sense?
	let playground: RemoteAPI<PlaygroundCliWorker>;

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
			worker.addListener('error', (e) => {
				const error = new Error(
					`Worker failed to load at ${workerUrl}. ${
						e.message ? `Original error: ${e.message}` : ''
					}`
				);
				(error as any).filename = workerUrl;
				reject(error);
			});
			// There is no way to know when the worker script has started
			// executing, so we use a message to signal that.
			function onStartup(event: string) {
				// TODO: Use 'online' event instead because it doesn't require participation of the worker script
				// https://nodejs.org/api/worker_threads.html#event-online
				if (event === 'worker-script-started') {
					resolve(worker);
					worker.removeListener('message', onStartup);
				}
			}
			worker.addListener('message', onStartup);
		});
	}

	function parseMounts(mounts: string[] | undefined): Mount[] {
		return (
			mounts?.map((mount) => {
				const [hostPath, vfsPath] = mount.split(':');
				return { hostPath, vfsPath };
			}) || []
		);
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
			}
			logger.log(
				`Resolved WordPress release URL: ${wpDetails?.releaseUrl}`
			);

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

			const constants: Record<string, string | number | boolean | null> =
				{
					WP_DEBUG: true,
					WP_DEBUG_LOG: true,
					WP_DEBUG_DISPLAY: false,
				};

			const followSymlinks = args.followSymlinks === true;
			try {
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
				}
				logger.log(
					`Resolved WordPress release URL: ${wpDetails?.releaseUrl}`
				);

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

				const mountsBeforeWpInstall = parseMounts(
					args.mountBeforeInstall
				);
				const mountsAfterWpInstall = parseMounts(args.mount);

				logger.log(`Fetching SQLite integration plugin...`);
				// TODO: Track progress
				const sqliteIntegrationPluginZip = args.skipSqliteSetup
					? undefined
					: await fetchSqliteIntegration(monitor);

				const moduleWorkerUrl = new URL(
					moduleWorkerUrlString,
					import.meta.url
				);
				const initialWorker = await spawnPHPWorkerThread(
					moduleWorkerUrl
				);
				playground = consumeAPI<PlaygroundCliWorker>(initialWorker);
				await playground.isConnected();

				// TODO: Add progress tracking

				// TODO: Is it necessary to worry about setting API ready?
				exposeAPI(fileLockManager, undefined, initialWorker);
				logger.log(`Booting WordPress...`);
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
					processIdBase: 0,
					followSymlinks,
				});
				logger.log(`Booted!`);

				await playground.isReady();

				wordPressReady = true;

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

				// TODO: Make multiple workers conditional on mounting of real /wordpress directory

				const internalZip = await zipDirectory(playground, '/internal');

				// Create secondary workers
				const additionalWorkers = [];
				const totalWorkers = 8;
				const workerProcessIdSpace = Math.floor(
					Number.MAX_SAFE_INTEGER / totalWorkers
				);
				for (let i = 1; i < totalWorkers; i++) {
					// TODO: Write as progress tracking
					logger.log(`Starting worker ${i}...`);
					const worker = await spawnPHPWorkerThread(moduleWorkerUrl);
					const additionalPlayground =
						consumeAPI<PlaygroundCliWorker>(worker);
					await additionalPlayground.isConnected();
					exposeAPI(fileLockManager, undefined, worker);

					// TODO: Parallelize booting and waiting for secondary workers to be ready
					// TODO: Fix auto-login
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
						// TODO: Explain why
						processIdBase: i * workerProcessIdSpace,
						followSymlinks,
					});
					await additionalPlayground.isReady();

					await additionalPlayground.writeFile(
						'/tmp/internal.zip',
						internalZip
					);
					await unzipFile(
						additionalPlayground,
						'/tmp/internal.zip',
						'/internal'
					);

					additionalWorkers.push(additionalPlayground);
				}

				loadBalancer = new LoadBalancer([
					playground,
					...additionalWorkers,
				]);

				logger.log(`WordPress is running on ${absoluteUrl}`);

				return {
					playground,
					server,
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

// TODO: Let's merge worker management into PHPProcessManager
// when we can have multiple workers in both CLI and web.
// Please don't expand upon this as an independent abstraction.
// TODO: Could we just spawn a worker using the factory function to PHPProcessManager?
type WorkerLoad = {
	worker: RemoteAPI<PlaygroundCliWorker>;
	activeRequests: Set<Promise<PHPResponse>>;
};
class LoadBalancer {
	workerLoads: WorkerLoad[] = [];

	constructor(workers: RemoteAPI<PlaygroundCliWorker>[]) {
		this.workerLoads = workers.map((worker) => ({
			worker,
			activeRequests: new Set(),
		}));
	}

	async handleRequest(request: PHPRequest) {
		let smallestWorkerLoad = this.workerLoads[0];
		let smallestWorkerLoadIndex = 0;

		// TODO: Is there any way for us to track CPU load so we could avoid
		//       picking a worker that is under heavy load despite few requests?
		// Possibly this: https://nodejs.org/api/worker_threads.html#workerperformance
		// Though we probably don't need to worry about it.
		for (let i = 1; i < this.workerLoads.length; i++) {
			const workerLoad = this.workerLoads[i];
			if (
				workerLoad.activeRequests.size <
				smallestWorkerLoad.activeRequests.size
			) {
				smallestWorkerLoad = workerLoad;
				smallestWorkerLoadIndex = i;
			}
		}

		// TODO: Add trace facility to Playground CLI to observe internals
		// TODO: Remove this after testing
		logger.log(
			`selected worker ${smallestWorkerLoadIndex} for ${
				request.url
			} out of workloads ${this.workerLoads.map(
				(w, i) => `${i}: ${w.activeRequests.size}`
			)}`
		);

		const promiseForResponse = smallestWorkerLoad.worker.request(request);
		smallestWorkerLoad.activeRequests.add(promiseForResponse);

		// Add URL to promise for use while debugging
		(promiseForResponse as any).url = request.url;

		return promiseForResponse.finally(() => {
			// TODO: Add trace for each request
			// console.log(
			// 	`worker ${smallestWorkerLoadIndex} completed request for ${request.url}`
			// );
			smallestWorkerLoad.activeRequests.delete(promiseForResponse);
		});
	}
}
