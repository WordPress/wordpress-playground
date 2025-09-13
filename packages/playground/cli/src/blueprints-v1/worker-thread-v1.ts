import type { FileLockManager } from '@php-wasm/node';
import { loadNodeRuntime } from '@php-wasm/node';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import type { RemoteAPI, SupportedPHPVersion } from '@php-wasm/universal';
import {
	PHPWorker,
	consumeAPI,
	consumeAPISync,
	exposeAPI,
	sandboxedSpawnHandlerFactory,
} from '@php-wasm/universal';
import { sprintf } from '@php-wasm/util';
import { RecommendedPHPVersion, zipDirectory } from '@wp-playground/common';
import {
	bootWordPress,
	resolveWordPressRelease,
} from '@wp-playground/wordpress';
import { rootCertificates } from 'tls';
import { jspi } from 'wasm-feature-detect';
import { MessageChannel, type MessagePort, parentPort } from 'worker_threads';
import { mountResources } from '../mounts';
import fs from 'fs';
import path from 'path';
import {
	CACHE_FOLDER,
	cachedDownload,
	fetchSqliteIntegration,
	readAsFile,
} from './download';

export interface Mount {
	hostPath: string;
	vfsPath: string;
}

export type WorkerBootOptions = {
	wpVersion?: string;
	phpVersion?: SupportedPHPVersion;
	absoluteUrl: string;
	mountsBeforeWpInstall: Array<Mount>;
	mountsAfterWpInstall: Array<Mount>;
	wordPressZip?: ArrayBuffer;
	sqliteIntegrationPluginZip?: ArrayBuffer;
	firstProcessId: number;
	processIdSpaceLength: number;
	dataSqlPath?: string;
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
	withXdebug?: boolean;
	/** Skip downloading and installing WordPress */
	skipWordPressSetup?: boolean;
	/** Skip downloading SQLite integration plugin */
	skipSqliteSetup?: boolean;
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
	booted = false;
	fileLockManager: RemoteAPI<FileLockManager> | FileLockManager | undefined;
	progressPort: MessagePort | undefined;

	constructor(monitor: EmscriptenDownloadMonitor) {
		super(undefined, monitor);
	}

	/**
	 * Provide a MessagePort to receive progress and error updates from the worker.
	 */
	async setProgressPort(port: MessagePort) {
		this.progressPort = port;
	}

	private postProgress(message: {
		phase: 'wordpress' | 'sqlite';
		loaded: number;
		total: number;
		finished: boolean;
	}) {
		try {
			this.progressPort?.postMessage({ type: 'progress', ...message });
		} catch {}
	}

	private postError(message: string) {
		try {
			this.progressPort?.postMessage({ type: 'error', message });
		} catch {}
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
		if (await jspi()) {
			/**
			 * If JSPI is available, php.js supports both synchronous and asynchronous locking syscalls.
			 * Web browsers, however, only support asynchronous message passing so let's use the
			 * asynchronous API. Every method call will return a promise.
			 *
			 * @see comlink-sync.ts
			 * @see phpwasm-emscripten-library-file-locking-for-node.js
			 */
			this.fileLockManager = consumeAPI<FileLockManager>(port);
		} else {
			/**
			 * If JSPI is not available, php.js only supports synchronous locking syscalls.
			 * Let's use the synchronous API. Every method call will block this thread
			 * until the result is available.
			 *
			 * @see comlink-sync.ts
			 * @see phpwasm-emscripten-library-file-locking-for-node.js
			 */
			this.fileLockManager = await consumeAPISync<FileLockManager>(port);
		}
	}

	async bootAsPrimaryWorker({
		absoluteUrl,
		mountsBeforeWpInstall,
		mountsAfterWpInstall,
		phpVersion = RecommendedPHPVersion,
		wordPressZip,
		sqliteIntegrationPluginZip,
		firstProcessId,
		processIdSpaceLength,
		dataSqlPath,
		followSymlinks,
		trace,
		internalCookieStore,
		withXdebug,
		wpVersion,
		skipWordPressSetup,
		skipSqliteSetup,
	}: WorkerBootOptions) {
		if (this.booted) {
			throw new Error('Playground already booted');
		}
		this.booted = true;

		let nextProcessId = firstProcessId;
		const lastProcessId = firstProcessId + processIdSpaceLength - 1;

		try {
			const constants: Record<string, string | number | boolean | null> =
				{
					WP_DEBUG: true,
					WP_DEBUG_LOG: true,
					WP_DEBUG_DISPLAY: false,
				};

			// Resolve and download artifacts if not provided by caller
			let wordPressZipFile: File | undefined;
			let sqliteIntegrationPluginZipFile: File | undefined;
			let preinstalledWpContentPath: string | undefined;

			if (wordPressZip !== undefined) {
				wordPressZipFile = new File([wordPressZip], 'wordpress.zip');
			} else if (!skipWordPressSetup) {
				const monitor = new EmscriptenDownloadMonitor();
				monitor.addEventListener('progress', ((
					e: CustomEvent<ProgressEvent & { finished: boolean }>
				) => {
					this.postProgress({
						phase: 'wordpress',
						loaded: e.detail.loaded,
						total: e.detail.total,
						finished: e.detail.finished,
					});
				}) as any);

				const wpDetails = await resolveWordPressRelease(
					wpVersion || 'latest'
				);
				preinstalledWpContentPath = path.join(
					CACHE_FOLDER,
					`prebuilt-wp-content-for-wp-${wpDetails.version}.zip`
				);
				if (fs.existsSync(preinstalledWpContentPath)) {
					wordPressZipFile = readAsFile(preinstalledWpContentPath);
				} else {
					wordPressZipFile = await cachedDownload(
						wpDetails.releaseUrl,
						`${wpDetails.version}.zip`,
						monitor
					);
				}
			}

			if (sqliteIntegrationPluginZip !== undefined) {
				sqliteIntegrationPluginZipFile = new File(
					[sqliteIntegrationPluginZip],
					'sqlite-integration-plugin.zip'
				);
			} else if (!skipSqliteSetup) {
				const sqliteMonitor = new EmscriptenDownloadMonitor();
				sqliteMonitor.addEventListener('progress', ((
					e: CustomEvent<ProgressEvent & { finished: boolean }>
				) => {
					this.postProgress({
						phase: 'sqlite',
						loaded: e.detail.loaded,
						total: e.detail.total,
						finished: e.detail.finished,
					});
				}) as any);
				sqliteIntegrationPluginZipFile = await fetchSqliteIntegration(
					sqliteMonitor
				);
			}

			const requestHandler = await bootWordPress({
				siteUrl: absoluteUrl,
				createPhpRuntime: async () => {
					const processId = nextProcessId;

					if (nextProcessId < lastProcessId) {
						nextProcessId++;
					} else {
						// We've reached the end of the process ID space. Start over.
						nextProcessId = firstProcessId;
					}

					return await loadNodeRuntime(phpVersion, {
						emscriptenOptions: {
							fileLockManager: this.fileLockManager!,
							processId,
							trace: trace ? tracePhpWasm : undefined,
						},
						followSymlinks,
						withXdebug,
					});
				},
				wordPressZip: wordPressZipFile,
				sqliteIntegrationPluginZip: sqliteIntegrationPluginZipFile,
				sapiName: 'cli',
				createFiles: {
					'/internal/shared/ca-bundle.crt':
						rootCertificates.join('\n'),
				},
				constants,
				phpIniEntries: {
					'openssl.cafile': '/internal/shared/ca-bundle.crt',
					allow_url_fopen: '1',
					disable_functions: '',
				},
				hooks: {
					async beforeWordPressFiles(php) {
						mountResources(php, mountsBeforeWpInstall);
					},
				},
				cookieStore: internalCookieStore ? undefined : false,
				dataSqlPath,
				spawnHandler: sandboxedSpawnHandlerFactory,
			});
			this.__internal_setRequestHandler(requestHandler);

			const primaryPhp = await requestHandler.getPrimaryPhp();
			await this.setPrimaryPHP(primaryPhp);

			mountResources(primaryPhp, mountsAfterWpInstall);

			// Cache preinstalled WordPress for faster subsequent boots if applicable
			if (
				!skipWordPressSetup &&
				mountsBeforeWpInstall.length === 0 &&
				preinstalledWpContentPath &&
				!fs.existsSync(preinstalledWpContentPath)
			) {
				try {
					const zipBuffer = await zipDirectory(
						primaryPhp,
						'/wordpress'
					);
					fs.mkdirSync(path.dirname(preinstalledWpContentPath), {
						recursive: true,
					});
					fs.writeFileSync(preinstalledWpContentPath, zipBuffer);
				} catch (err) {
					// Non-fatal; log to progress channel
					this.postError(
						(err as Error)?.message ||
							'Failed to cache preinstalled WordPress'
					);
				}
			}

			setApiReady();
		} catch (e) {
			setAPIError(e as Error);
			throw e;
		}
	}

	async bootAsSecondaryWorker(args: WorkerBootOptions) {
		return this.bootAsPrimaryWorker(args);
	}

	// Provide a named disposal method that can be invoked via comlink.
	async dispose() {
		await this[Symbol.asyncDispose]();
	}
}

const phpChannel = new MessageChannel();

const [setApiReady, setAPIError] = exposeAPI(
	new PlaygroundCliBlueprintV1Worker(new EmscriptenDownloadMonitor()),
	undefined,
	phpChannel.port1
);

parentPort!.postMessage(
	{
		command: 'worker-script-initialized',
		phpPort: phpChannel.port2,
	},
	[phpChannel.port2 as any]
);
