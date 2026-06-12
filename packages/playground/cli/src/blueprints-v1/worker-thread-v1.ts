import type { FileLockManager } from '@php-wasm/universal';
import { loadNodeRuntime, type PHPExtension } from '@php-wasm/node';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import type { AllPHPVersion, PathAlias, RemoteAPI } from '@php-wasm/universal';
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
import {
	MessageChannel,
	type MessagePort,
	type MessagePort as NodeMessagePort,
	parentPort,
} from 'worker_threads';
import { mountResources } from '../mounts';
import { logger } from '@php-wasm/logger';
import { spawnWorkerThread } from '../run-cli';

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

interface WorkerBootRequestHandlerOptions {
	siteUrl: string;
	phpVersion: AllPHPVersion;
	processId: number;
	trace: boolean;
	nativeInternalDirPath: string;
	mountsBeforeWpInstall: Array<Mount>;
	mountsAfterWpInstall: Array<Mount>;
	followSymlinks: boolean;
	extensions?: PHPExtension[];
	pathAliases?: PathAlias[];
	/**
	 * Apply the post-install mounts as soon as the PHP instance is created,
	 * instead of waiting for WordPress to be installed in this worker.
	 *
	 * Set when spawning a child PHP process (proc_open()/system()) from a
	 * worker whose WordPress is already installed: the child is a fresh
	 * worker that never installs WordPress itself, so without this flag its
	 * `bootedWordPress` stays false and the post-install `--mount`s (e.g. the
	 * plugin/theme directory) would never be applied — making mounted files
	 * invisible to the spawned process.
	 */
	applyPostInstallMountsImmediately?: boolean;
}

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

/**
 * Minimal API the main thread exposes so a worker can hand a spawned child a
 * direct MessagePort to the shared file lock manager.
 */
type FileLockManagerService = {
	/** Attach the shared lock manager to `port`; returns an attachment id. */
	attachFileLockManager: (port: NodeMessagePort) => Promise<number>;
	/** Release a previously attached port (closes it on the main thread). */
	detachFileLockManager: (id: number) => Promise<void>;
};

export class PlaygroundCliBlueprintV1Worker extends PHPWorker {
	bootedRequestHandler = false;
	bootedWordPress = false;
	fileLockManager: FileLockManager | undefined;
	/**
	 * Service exposed by the main thread that connects a fresh MessagePort to
	 * the shared file lock manager. Used when spawning a child PHP process so
	 * the child talks to the broker directly instead of relaying through this
	 * worker — which is synchronously blocked inside system()/proc_open() and
	 * would otherwise deadlock the child's flock() calls.
	 */
	lockManagerService: RemoteAPI<FileLockManagerService> | undefined;

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
	 * Receive the main thread's file-lock-manager service so this worker can
	 * mint direct broker ports for the PHP children it spawns.
	 */
	async useFileLockManagerService(port: MessagePort) {
		this.lockManagerService = consumeAPI<FileLockManagerService>(port);
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

	async bootRequestHandler(options: WorkerBootRequestHandlerOptions) {
		if (this.bootedRequestHandler) {
			throw new Error('Playground already booted');
		}
		this.bootedRequestHandler = true;

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
					if (
						this.bootedWordPress ||
						options.applyPostInstallMountsImmediately
					) {
						await mountResources(php, options.mountsAfterWpInstall);
					}
				},
				sapiName: 'cli',
				cookieStore: false,
				pathAliases: options.pathAliases,
				spawnHandler: () =>
					sandboxedSpawnHandlerFactory(() => {
						let effectiveOptions = options;
						if (!this.bootedWordPress) {
							// WordPress is not yet booted so skip the post-install mounts.
							effectiveOptions = {
								...options,
								mountsAfterWpInstall: [],
							};
						}

						return createPHPWorker(
							{
								...effectiveOptions,
								// A spawned child never installs WordPress
								// itself, so it must apply the post-install
								// mounts as soon as it starts — otherwise
								// mounted files would be invisible to the
								// spawned process. (When the spawning worker
								// hasn't booted WordPress yet, the mounts were
								// already cleared above, so this is a no-op.)
								applyPostInstallMountsImmediately: true,
							},
							this.lockManagerService!
						);
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

/**
 * Spawns a new PHP process to be used in the PHP spawn handler (in proc_open() etc. calls).
 * It boots from this worker-thread-v1.ts file, but is a separate process.
 *
 * We explicitly avoid using PHPProcessManager.acquirePHPInstance() here.
 *
 * Why?
 *
 * Because each PHP instance acquires actual OS-level file locks via fcntl() and LockFileEx()
 * syscalls. Running multiple PHP instances from the same OS process would allow them to
 * acquire overlapping locks. Running every PHP instance in a separate OS process ensures
 * any locks that overlap between PHP instances conflict with each other as expected.
 *
 * @param options - The options for the worker.
 * @param lockManagerService - Main-thread service used to give the child a
 *   direct MessagePort to the shared file lock manager.
 * @returns A promise that resolves to the PHP worker.
 */
async function createPHPWorker(
	// NOTE: We explicitly remove processId from the options
	// type so the type system will catch if we try to reuse
	// our parent's process ID.
	options: Omit<WorkerBootRequestHandlerOptions, 'processId'>,
	lockManagerService: RemoteAPI<FileLockManagerService>
) {
	const spawnedWorker = await spawnWorkerThread('v1');

	const handler = consumeAPI<PlaygroundCliBlueprintV1Worker>(
		spawnedWorker.phpPort
	);

	// Give the child a DIRECT line to the shared file lock manager. Passing this
	// worker's own lock-manager proxy would route the child's synchronous
	// flock() calls back through this worker — which is blocked inside system()
	// while the child runs — deadlocking the child (it would time out waiting
	// for a response). Instead, ask the main thread to attach the broker to a
	// fresh channel and hand the child the other end.
	//
	// Both ports are transferred away, so they're cleaned up where they end up:
	// port2 dies with the child when the worker is terminated in reap() below,
	// and reap() asks the main thread to close port1 via detachFileLockManager().
	const { port1, port2 } = new MessageChannel();
	const lockManagerPortId =
		await lockManagerService.attachFileLockManager(port1);
	await handler.useFileLockManager(port2);

	await handler.bootRequestHandler({
		...options,
		processId: spawnedWorker.processId,
	});

	return {
		php: handler,
		reap: () => {
			try {
				handler.dispose();
			} catch {
				/** */
			}
			try {
				spawnedWorker.worker.terminate();
			} catch {
				/** */
			}
			// Deterministically release the main-thread lock-manager port
			// for this child so the server doesn't leak ports/listeners.
			// Best-effort: swallow the async rejection so reap() can't throw.
			lockManagerService
				.detachFileLockManager(lockManagerPortId)
				.catch(() => {
					/** */
				});
		},
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
