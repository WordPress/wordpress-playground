import { errorLogPath, logger } from '@php-wasm/logger';
import { EmscriptenDownloadMonitor, ProgressTracker } from '@php-wasm/progress';
import {
	consumeAPI,
	exposeAPI,
	PHPRequest,
	PHPResponse,
	RemoteAPI,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import {
	BlueprintDeclaration,
	BlueprintBundle,
	compileBlueprint,
	runBlueprintSteps,
} from '@wp-playground/blueprints';
import { RecommendedPHPVersion } from '@wp-playground/common';
import fs from 'fs';
import { Server } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import {
	CACHE_FOLDER,
	cachedDownload,
	fetchSqliteIntegration,
	readAsFile,
} from './download';
import { startServer } from './server';
import { resolveWordPressRelease } from '@wp-playground/wordpress';
import { Worker } from 'worker_threads';
import { PlaygroundCliWorker, Mount } from './worker-thread';
import { FileLockManagerForNode } from '@php-wasm/node';
import nodeEndpoint from 'comlink/dist/esm/node-adapter';
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
	wp?: string;
}

export interface RunCLIServer {
	// TODO: Create interface over multiple workers?
	playground: RemoteAPI<PlaygroundCliWorker>;
	server: Server;
}

// TODO: Restore this to a Promise for RunCLIServer?
export async function runCLI(args: RunCLIArgs): Promise<RunCLIServer> {
	let playground: RemoteAPI<PlaygroundCliWorker>;

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
		let blueprint: BlueprintDeclaration | BlueprintBundle | undefined;

		if (args.blueprint) {
			blueprint = args.blueprint as
				| BlueprintDeclaration
				| BlueprintBundle;
		} else {
			blueprint = {
				preferredVersions: {
					php: args.php ?? RecommendedPHPVersion,
					wp: args.wp ?? 'latest',
				},
				login: args.login,
			};
		}

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
	async function spawnPHPWorkerThread(workerUrl: string) {
		const worker = new Worker(workerUrl);
		return new Promise<Worker>((resolve, reject) => {
			worker.addListener('error', (e) => {
				const error = new Error(
					`WebWorker failed to load at ${workerUrl}. ${
						e.message ? `Original error: ${e.message}` : ''
					}`
				);
				(error as any).filename = workerUrl;
				reject(error);
			});
			// There is no way to know when the worker script has started
			// executing, so we use a message to signal that.
			function onStartup(event: string) {
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

	let wordPressReady = false;

	logger.log('Starting a PHP server...');

	return startServer({
		port: args['port'] as number,
		onBind: async (server: Server, port: number): Promise<RunCLIServer> => {
			const absoluteUrl = `http://127.0.0.1:${port}`;
			const lockManager = new FileLockManagerForNode();

			// TODO
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
				wordPressZip?.arrayBuffer();

				const workerUrl = new URL('worker-thread.js', import.meta.url);
				const workerPath = fileURLToPath(workerUrl);
				const worker = await spawnPHPWorkerThread(workerPath);

				// TODO: Is it necessary to worry about setting API ready?
				exposeAPI(lockManager, undefined, nodeEndpoint(worker));

				console.log('consumeAPI');
				playground = consumeAPI<PlaygroundCliWorker>(worker);
				await playground.isConnected();
				console.log('consumeAPI isConnected');

				// TODO: Add progress tracking
				const mountsBeforeWpInstall = parseMounts(
					args.mountBeforeInstall
				);
				const mountsAfterWpInstall = parseMounts(args.mount);
				console.log(
					'parseMounts',
					mountsBeforeWpInstall,
					mountsAfterWpInstall
				);

				const sqliteIntegrationPluginZip = await fetchSqliteIntegration(
					monitor
				);
				console.log('sqlite zip is here');

				await playground.boot({
					phpVersion: args.php,
					wpVersion: args.wp,
					absoluteUrl,
					mountsBeforeWpInstall,
					mountsAfterWpInstall,
					shouldInstallWordPress: !args.skipWordPressSetup,
					wordPressZip: await wordPressZip!.arrayBuffer(),
					sqliteIntegrationPluginZip:
						await sqliteIntegrationPluginZip!.arrayBuffer(),
					// TODO: Set different bases per worker
					runtimeIdBase: 0,
				});
				console.log('booted', playground);

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
				} else {
					logger.log(`WordPress is running on ${absoluteUrl}`);
				}

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
			return await playground.request(request);
		},
	});
}
