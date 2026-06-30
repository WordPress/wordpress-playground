import type { FileLockManager } from '@php-wasm/universal';
import { loadNodeRuntime, type PHPExtension } from '@php-wasm/node';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import type { AllPHPVersion, PathAlias } from '@php-wasm/universal';
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

export class PlaygroundCliBlueprintV1Worker extends PHPWorker {
	bootedRequestHandler = false;
	bootedWordPress = false;
	fileLockManager: FileLockManager | undefined;

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
					if (this.bootedWordPress) {
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
							effectiveOptions,
							this.fileLockManager!
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
 * @param fileLockManager - The file lock manager to use.
 * @returns A promise that resolves to the PHP worker.
 */
async function createPHPWorker(
	// NOTE: We explicitly remove processId from the options
	// type so the type system will catch if we try to reuse
	// our parent's process ID.
	options: Omit<WorkerBootRequestHandlerOptions, 'processId'>,
	fileLockManager: FileLockManager
) {
	const spawnedWorker = await spawnWorkerThread('v1');

	const handler = consumeAPI<PlaygroundCliBlueprintV1Worker>(
		spawnedWorker.phpPort
	);
	handler.useFileLockManager(fileLockManager as any);
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
