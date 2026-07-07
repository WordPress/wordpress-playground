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
	wpVersion?: string;
	wordpressInstallMode: WordPressInstallMode;
	wordPressZip?: ArrayBuffer;
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

export class PlaygroundCliBlueprintV1Worker extends PHPWorker {
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

	/**
	 * Receive the main thread's child-worker service so this worker can spawn
	 * child workers for the PHP processes it starts via proc_open()/system().
	 */
	async useChildWorkerService(port: MessagePort) {
		this.childWorkerService = consumeAPI<ChildWorkerService>(port);
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
				phpIniEntries: {
					'openssl.cafile': '/internal/shared/ca-bundle.crt',
					'curl.cainfo': '/internal/shared/ca-bundle.crt',
					allow_url_fopen: '1',
					disable_functions: '',
				},
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
		workerConfig: WorkerConfig
	) {
		if (this.bootedRequestHandler) {
			throw new Error('Playground already booted');
		}
		this.bootedRequestHandler = true;

		// Remember the platform config so we can forward it verbatim to any
		// child worker this one spawns via proc_open()/system().
		this.platformConfig = platformConfig;
		// A spawned child never installs WordPress itself, so it relies on the
		// bootedWordPress state passed at boot to decide whether to apply the
		// post-install (--mount) mounts.
		this.bootedWordPress =
			workerConfig.bootedWordPress ?? this.bootedWordPress;

		const options: WorkerBootRequestHandlerOptions = {
			...platformConfig,
			...workerConfig,
		};

		try {
			const requestHandler = await bootRequestHandler({
				siteUrl: options.siteUrl,
				phpVersion: options.phpVersion,
				maxPhpInstances: 1,
				createPhpRuntime: createPhpRuntimeFactory(
					options,
					this.fileLockManager!
				),
				onPHPInstanceCreated: async (php) => {
					await mountResources(php, options.mountsBeforeWpInstall);

					// NOTE: We currently create all request workers up front
					// and apply post-install mounts to all the workers immediately
					// following WordPress install. But if we start creating
					// request-handling workers on-demand, we will to apply post-install
					// mounts here.
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
									'worker has no child-worker service. ' +
									'Call useChildWorkerService() on the ' +
									'worker to enable spawning via ' +
									'proc_open()/system().'
							);
						}

						// Ask the main thread to create and pre-wire a child
						// worker: it spawns the worker, exposes a direct
						// FileLockManager port and a service port on it, and
						// mints a fresh processId. We just plug the ports in
						// and boot it.
						const { phpPort, lockPort, servicePort, processId } =
							await this.childWorkerService.createChildWorker();
						try {
							const child =
								consumeAPI<PlaygroundCliBlueprintV1Worker>(
									phpPort
								);
							// The child talks to the shared lock manager on the
							// MAIN thread directly (lockPort's far end is
							// exposed there), never relaying its synchronous
							// flock() calls through this worker — which is
							// blocked inside system() while the child runs and
							// would otherwise deadlock it.
							await child.useFileLockManager(lockPort);
							// Let the child spawn its own children (nested
							// proc_open()/system()) that also reach the main
							// thread directly.
							await child.useChildWorkerService(servicePort);
							await child.bootRequestHandler(
								this.platformConfig!,
								{
									processId,
									// A spawned child never installs WordPress
									// itself, so it applies the post-install mounts
									// based on whether THIS worker has booted
									// WordPress.
									bootedWordPress: this.bootedWordPress,
								}
							);
							return {
								php: child,
								reap: () => {
									try {
										child.dispose();
									} catch {
										/** */
									}
									// Deterministically terminate the child and
									// release its main-thread ports. Best-effort:
									// swallow the async rejection so reap() can't
									// throw.
									this.childWorkerService!.disposeChildWorker(
										processId
									).catch(() => {
										/** */
									});
								},
							};
						} catch (e) {
							// Roll back so a failed spawn can't leak the child
							// worker or its main-thread ports.
							this.childWorkerService
								.disposeChildWorker(processId)
								.catch(() => {
									/** */
								});
							throw e;
						}
					}),
			});
			this.__internal_setRequestHandler(requestHandler);

			const primaryPhp = await requestHandler.getPrimaryPhp();
			await this.setPrimaryPHP(primaryPhp);

			setApiReady();
		} catch (e) {
			setAPIError(e as Error);
			throw e;
		}
	}

	async mountAfterWordPressInstall(mounts: Array<Mount>) {
		// Make sure workers not involved in the WordPress install
		// process know whether WordPress booted so they can
		// apply post-install mounts when spawning new PHP workers.
		this.bootedWordPress = true;
		await mountResources(this.__internal_getPHP()!, mounts);
	}

	// Provide a named disposal method that can be invoked via comlink.
	async dispose() {
		await this[Symbol.asyncDispose]();
	}
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
	new PlaygroundCliBlueprintV1Worker(new EmscriptenDownloadMonitor()),
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
