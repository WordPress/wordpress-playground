import type { FileLockManager } from '@php-wasm/universal';
import {
	loadNodeRuntime,
	bindUserSpace,
	type OSUserSpaceContext,
} from '@php-wasm/node';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import type {
	PathAlias,
	SupportedPHPVersion,
} from '@php-wasm/universal';
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

export type WorkerBootOptions = {
	phpVersion: SupportedPHPVersion;
	siteUrl: string;
	mountsBeforeWpInstall: Array<Mount>;
	mountsAfterWpInstall: Array<Mount>;
	firstProcessId: number;
	processIdSpaceLength: number;
	followSymlinks: boolean;
	trace: boolean;
	/**
	 * When true, Playground will not send cookies to the client but will manage
	 * them internally. This can be useful in environments that can't store cookies,
	 * e.g. VS Code WebView.
	 *
	 * Default: false.
	 */
	internalCookieStore?: boolean;
	withIntl?: boolean;
	withRedis?: boolean;
	withMemcached?: boolean;
	withXdebug?: boolean;
	nativeInternalDirPath: string;
	/**
	 * PHP constants to define via php.defineConstant().
	 * Process-specific, set for each PHP instance.
	 */
	constants?: Record<string, string | number | boolean | null>;
	/**
	 * Path aliases that map URL prefixes to filesystem paths outside
	 * the document root. Similar to Nginx's `alias` directive.
	 */
	pathAliases?: PathAlias[];
};

export type WorkerBootWordPressOptions = {
	siteUrl: string;
	wpVersion?: string;
	wordpressInstallMode: WordPressInstallMode;
	wordPressZip?: ArrayBuffer;
	sqliteIntegrationPluginZip?: ArrayBuffer;
	dataSqlPath?: string;
};

interface WorkerBootRequestHandlerOptions {
	siteUrl: string;
	followSymlinks: boolean;
	phpVersion: SupportedPHPVersion;
	firstProcessId: number;
	processIdSpaceLength: number;
	trace: boolean;
	nativeInternalDirPath: string;
	mountsBeforeWpInstall: Array<Mount>;
	mountsAfterWpInstall: Array<Mount>;
	withIntl?: boolean;
	withRedis?: boolean;
	withMemcached?: boolean;
	withXdebug?: boolean;
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
	booted = false;
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
		const {
			siteUrl,
			wordpressInstallMode,
			wordPressZip,
			sqliteIntegrationPluginZip,
			dataSqlPath,
		} = options;

		try {
			await bootWordPress(this.__internal_getRequestHandler()!, {
				siteUrl,
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
					allow_url_fopen: '1',
					disable_functions: '',
				},
				dataSqlPath,
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

	async hello() {
		return 'hello';
	}

	async bootWorker(args: WorkerBootOptions) {
		await this.bootRequestHandler(args);
	}

	async bootRequestHandler(options: WorkerBootRequestHandlerOptions) {
		if (this.booted) {
			throw new Error('Playground already booted');
		}
		this.booted = true;

		try {
			const requestHandler = await bootRequestHandler({
				siteUrl: options.siteUrl,
				maxPhpInstances: 1,
				createPhpRuntime: createPhpRuntimeFactory(
					options,
					this.fileLockManager!
				),
				onPHPInstanceCreated: async (php) => {
					await mountResources(php, options.mountsBeforeWpInstall);
					await mountResources(php, options.mountsAfterWpInstall);
				},
				sapiName: 'cli',
				cookieStore: false,
				pathAliases: options.pathAliases,
				spawnHandler: () =>
					sandboxedSpawnHandlerFactory(() =>
						createPHPWorker(options, this.fileLockManager!)
					),
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
	let nextProcessId = options.firstProcessId;
	const lastProcessId =
		options.firstProcessId + options.processIdSpaceLength - 1;
	return async () => {
		const processId = nextProcessId;

		if (nextProcessId < lastProcessId) {
			nextProcessId++;
		} else {
			// We've reached the end of the process ID space. Start over.
			nextProcessId = options.firstProcessId;
		}

		return await loadNodeRuntime(
			options.phpVersion || RecommendedPHPVersion,
			{
				emscriptenOptions: {
					processId,
					trace: options.trace ? tracePhpWasm : undefined,
					nativeInternalDirPath: options.nativeInternalDirPath,
					bindUserSpace: (userSpaceContext: OSUserSpaceContext) => {
						return bindUserSpace(
							{
								fileLockManager,
							},
							userSpaceContext
						);
					},
				},
				followSymlinks: options.followSymlinks,
				withIntl: options.withIntl,
				withRedis: options.withRedis,
				withMemcached: options.withMemcached,
				withXdebug: options.withXdebug,
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
	options: WorkerBootRequestHandlerOptions,
	fileLockManager: FileLockManager
) {
	const spawnedWorker = await spawnWorkerThread('v1');

	const handler = consumeAPI<PlaygroundCliBlueprintV1Worker>(
		spawnedWorker.phpPort
	);
	handler.useFileLockManager(fileLockManager as any);
	await handler.bootWorker(options);

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
