import type { FileLockManager } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import type { RemoteAPI } from '@php-wasm/universal';
import {
	PHPWorker,
	releaseApiProxy,
	consumeAPI,
	consumeAPISync,
	exposeAPI,
	sandboxedSpawnHandlerFactory,
} from '@php-wasm/universal';
import { sprintf } from '@php-wasm/util';
import { RecommendedPHPVersion } from '@wp-playground/common';
import {
	type WordPressInstallMode,
	bootRequestHandler,
	bootWordPress,
} from '@wp-playground/wordpress';
import { rootCertificates } from 'tls';
import { MessageChannel, type MessagePort, parentPort } from 'worker_threads';
import { mountResources } from '../mounts';
import { logger } from '@php-wasm/logger';
import type {
	ChildWorkerService,
	WorkerBootRequestHandlerOptions,
	WorkerConfig,
	WorkerPlatformConfig,
} from '../worker-boot-config';

import type { Mount } from '@php-wasm/cli-util';

export type WorkerBootWordPressOptions = {
	siteUrl: string;
	phpVersion?: string;
	wordpressInstallMode: WordPressInstallMode;
	wordPressZip?: ArrayBuffer;
	networking?: boolean;
	sqliteIntegrationPluginZip?: ArrayBuffer;
	dataSqlPath?: string;
	/**
	 * PHP constants to define via php.defineConstant().
	 */
	constants?: Record<string, string | number | boolean>;
};

/**
 * Print trace messages from PHP-WASM.
 *
 * @param {number} processId - The process ID.
 * @param {string} format - The format string.
 * @param {...any} args - The arguments.
 */
function tracePhpWasm(processId: number, format: string, ...args: any[]) {
	// eslint-disable-next-line no-console
	console.log(
		performance.now().toFixed(6).padStart(15, '0'),
		processId.toString().padStart(16, '0'),
		sprintf(format, ...args)
	);
}

function getNetworkingPhpIniEntries(networking: boolean) {
	return {
		'openssl.cafile': '/internal/shared/ca-bundle.crt',
		'curl.cainfo': '/internal/shared/ca-bundle.crt',
		allow_url_fopen: networking ? '1' : '0',
		disable_functions: networking
			? ''
			: 'fsockopen,pfsockopen,curl_init,curl_exec,curl_multi_exec,mail',
	};
}

export class PlaygroundCliBlueprintV2Worker extends PHPWorker {
	bootedRequestHandler = false;
	bootedWordPress = false;
	fileLockManager: FileLockManager | undefined;
	/**
	 * Platform-wide boot config this worker was started with, forwarded verbatim
	 * to any child worker it spawns via proc_open()/system().
	 */
	platformConfig: WorkerPlatformConfig | undefined;
	/**
	 * Service exposed by the main thread for creating child workers. Used when
	 * PHP in this worker shells out (proc_open()/system()): the main thread
	 * spawns and pre-wires the child so its synchronous flock() calls reach the
	 * broker directly instead of relaying through this worker — which is blocked
	 * inside system() while the child runs and would otherwise deadlock it.
	 */
	childWorkerService: RemoteAPI<ChildWorkerService> | undefined;

	constructor(monitor: EmscriptenDownloadMonitor) {
		super(undefined, monitor);
	}

	/**
	 * Call this method before boot() to use file locking.
	 *
	 * This method is separate from boot() to simplify the related Comlink.transferHandlers
	 * setup – if an argument is a MessagePort, we're transferring it, not copying it.
	 *
	 * @see comlink-sync.ts
	 * @see phpwasm-emscripten-library-file-locking-for-node.js
	 */
	async useFileLockManager(port: MessagePort) {
		this.fileLockManager = await consumeAPISync<FileLockManager>(port);
	}

	async bootWordPress(
		options: WorkerBootWordPressOptions,
		workerPostInstallMountsPort: MessagePort
	) {
		if (this.bootedWordPress) {
			throw new Error('WordPress already booted');
		}
		this.bootedWordPress = true;
		const {
			siteUrl,
			phpVersion,
			wordpressInstallMode,
			wordPressZip,
			networking = true,
			sqliteIntegrationPluginZip,
			dataSqlPath,
			constants,
		} = options;

		try {
			await bootWordPress(this.__internal_getRequestHandler()!, {
				siteUrl,
				phpVersion,
				wordpressInstallMode,
				wordPressZip:
					wordPressZip !== undefined
						? new File([wordPressZip], 'wordpress.zip')
						: undefined,
				sqliteIntegrationPluginZip:
					sqliteIntegrationPluginZip !== undefined
						? new File(
								[sqliteIntegrationPluginZip],
								'sqlite-integration-plugin.zip'
							)
						: undefined,
				// TODO: Are these redundant creations?
				createFiles: {
					'/internal/shared/ca-bundle.crt':
						rootCertificates.join('\n'),
				},
				phpIniEntries: getNetworkingPhpIniEntries(networking),
				dataSqlPath,
				constants,
			});

			// Notify all workers to apply post-install mounts.
			const postInstall = consumeAPI<{
				applyPostInstallMountsToAllWorkers: () => Promise<void>;
			}>(workerPostInstallMountsPort);
			await postInstall.applyPostInstallMountsToAllWorkers();
			postInstall[releaseApiProxy]();

			setApiReady();
		} catch (e) {
			setAPIError(e as Error);
			throw e;
		}
	}

	async bootRequestHandler(
		platformConfig: WorkerPlatformConfig,
		workerConfig: WorkerConfig,
		childWorkerServicePort: MessagePort
	) {
		if (this.bootedRequestHandler) {
			throw new Error('Playground already booted');
		}
		this.bootedRequestHandler = true;
		this.childWorkerService = consumeAPI<ChildWorkerService>(
			childWorkerServicePort
		);

		// Remember the platform config so we can forward it verbatim to any
		// child worker this one spawns via proc_open()/system().
		this.platformConfig = platformConfig;

		const options: WorkerBootRequestHandlerOptions = {
			...platformConfig,
			...workerConfig,
		};

		try {
			const requestHandler = await bootRequestHandler({
				siteUrl: options.siteUrl,
				phpVersion: options.phpVersion,
				maxPhpInstances: 1,
				createFiles: {
					'/internal/shared/ca-bundle.crt':
						rootCertificates.join('\n'),
				},
				phpIniEntries: getNetworkingPhpIniEntries(
					options.networking ?? true
				),
				createPhpRuntime: createPhpRuntimeFactory(
					options,
					this.fileLockManager!
				),
				onPHPInstanceCreated: async (php) => {
					await mountResources(php, options.mountsBeforeWpInstall);

					// Post-install mounting marks this worker as booted so any
					// replacement PHP runtimes receive the same mounts.
					if (this.bootedWordPress) {
						await mountResources(php, options.mountsAfterWpInstall);
					}
				},
				sapiName: 'cli',
				cookieStore: false,
				pathAliases: options.pathAliases,
				spawnHandler: () =>
					sandboxedSpawnHandlerFactory(async () => {
						if (!this.childWorkerService) {
							throw new Error(
								'Cannot spawn a child PHP process: this ' +
									'worker has no child-worker service.'
							);
						}

						// Ask the main thread to create and pre-wire a child
						// worker: it spawns the worker, exposes a direct
						// FileLockManager port and a service port on it, and
						// mints a fresh processId. We just plug the ports in
						// and boot it.
						const { childId, processId } =
							await this.childWorkerService.createChildWorker();
						const childExited =
							this.childWorkerService.waitForChildExit(childId);
						let child:
							| RemoteAPI<PlaygroundCliBlueprintV2Worker>
							| undefined;
						try {
							const phpPort = await raceWithChildExit(
								this.childWorkerService.takeChildWorkerPort(
									childId,
									'php'
								),
								childExited
							);
							const lockPort = await raceWithChildExit(
								this.childWorkerService.takeChildWorkerPort(
									childId,
									'fileLockManager'
								),
								childExited
							);
							const servicePort = await raceWithChildExit(
								this.childWorkerService.takeChildWorkerPort(
									childId,
									'childWorkerService'
								),
								childExited
							);
							const childApi =
								consumeAPI<PlaygroundCliBlueprintV2Worker>(
									phpPort
								);
							child = childApi;
							// The child talks to the shared lock manager on the
							// MAIN thread directly (lockPort's far end is
							// exposed there), never relaying its synchronous
							// flock() calls through this worker — which is
							// blocked inside system() while the child runs and
							// would otherwise deadlock it.
							await raceWithChildExit(
								childApi.useFileLockManager(lockPort),
								childExited
							);
							await raceWithChildExit(
								childApi.bootRequestHandler(
									this.platformConfig!,
									{
										processId,
										childId,
									},
									servicePort
								),
								childExited
							);
							return {
								php: childApi,
								exited: childExited,
								reap: () => {
									try {
										childApi[releaseApiProxy]();
									} catch {
										/** */
									}
									// Deterministically terminate the child and
									// release its main-thread ports. Best-effort:
									// swallow the async rejection so reap() can't
									// throw.
									this.childWorkerService!.disposeChildWorker(
										childId
									).catch(() => {
										/** */
									});
								},
							};
						} catch (e) {
							// Roll back so a failed spawn can't leak the child
							// worker or its main-thread ports.
							try {
								child?.[releaseApiProxy]();
							} catch {
								/** */
							}
							try {
								await this.childWorkerService.disposeChildWorker(
									childId
								);
							} catch {
								/** */
							}
							throw e;
						}
					}),
			});
			this.__internal_setRequestHandler(requestHandler);

			const primaryPhp = await requestHandler.getPrimaryPhp();
			await this.setPrimaryPHP(primaryPhp);
			if (workerConfig.childId !== undefined) {
				await this.childWorkerService.registerChildWorker(
					workerConfig.childId,
					(mounts) => this.mountAfterWordPressInstall(mounts)
				);
			}

			setApiReady();
		} catch (e) {
			setAPIError(e as Error);
			throw e;
		}
	}

	async mountAfterWordPressInstall(mounts: Array<Mount>) {
		// Make sure replacement PHP runtimes also receive post-install mounts.
		this.bootedWordPress = true;
		await mountResources(this.__internal_getPHP()!, mounts);
	}

	// Provide a named disposal method that can be invoked via comlink.
	async dispose() {
		await this[Symbol.asyncDispose]();
	}
}

function raceWithChildExit<T>(
	operation: Promise<T>,
	childExited: Promise<never>
): Promise<T> {
	return Promise.race([operation, childExited]);
}

/**
 * Returns a factory function that starts a new PHP runtime in the currently
 * running process. This is used for rotating the PHP runtime periodically.
 */
function createPhpRuntimeFactory(
	options: WorkerBootRequestHandlerOptions,
	fileLockManager: FileLockManager
) {
	return async () => {
		return await loadNodeRuntime(
			options.phpVersion || RecommendedPHPVersion,
			{
				fileLockManager,
				emscriptenOptions: {
					processId: options.processId,
					trace: options.trace ? tracePhpWasm : undefined,
					nativeInternalDirPath: options.nativeInternalDirPath,
				},
				followSymlinks: options.followSymlinks,
				extensions: options.extensions,
			}
		);
	};
}

process.on('unhandledRejection', (e: any) => {
	logger.error('Unhandled rejection:', e);
});

const phpChannel = new MessageChannel();

const [setApiReady, setAPIError] = exposeAPI(
	new PlaygroundCliBlueprintV2Worker(new EmscriptenDownloadMonitor()),
	undefined,
	phpChannel.port1
);

parentPort?.postMessage(
	{
		command: 'worker-script-initialized',
		phpPort: phpChannel.port2,
	},
	[phpChannel.port2 as any]
);
