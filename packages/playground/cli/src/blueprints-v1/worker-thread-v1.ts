// TODO: Rename this file to worker-process-v1.ts
import { loadNodeRuntime } from '@php-wasm/node';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import type {
	NodeProcess,
	PHPRequest,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import {
	PHPWorker,
	consumeAPI,
	exposeAPI,
	releaseRemoteApiProxy,
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
import { mountResources } from '../mounts';
import { logger } from '@php-wasm/logger';
import { killWorkerProcess, spawnWorkerProcess } from '../run-cli';
import { startServer } from '../start-server';

import type { Mount } from '@php-wasm/cli-util';
import cluster from 'cluster';

export type WorkerBootOptions = {
	phpVersion: SupportedPHPVersion;
	siteUrl: string;
	port: number;
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
	withXdebug?: boolean;
	nativeInternalDirPath: string;
};

export type WordPressBootOptions = {
	siteUrl: string;
	wordpressInstallMode: WordPressInstallMode;
	wordPressZip?: ArrayBuffer;
	sqliteIntegrationPluginZip?: ArrayBuffer;
	dataSqlPath?: string;
};

interface WorkerBootRequestHandlerOptions {
	port: number;
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
	withXdebug?: boolean;
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

	constructor(monitor: EmscriptenDownloadMonitor) {
		super(undefined, monitor);
	}

	async bootWordPress(options: WordPressBootOptions) {
		const {
			siteUrl,
			wordpressInstallMode,
			wordPressZip,
			sqliteIntegrationPluginZip,
			dataSqlPath,
		} = options;

		const constants: Record<string, string | number | boolean | null> = {
			WP_DEBUG: true,
			WP_DEBUG_LOG: true,
			WP_DEBUG_DISPLAY: false,
		};
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
			createFiles: {
				'/internal/shared/ca-bundle.crt': rootCertificates.join('\n'),
			},
			constants,
			phpIniEntries: {
				'openssl.cafile': '/internal/shared/ca-bundle.crt',
				allow_url_fopen: '1',
				disable_functions: '',
			},
			dataSqlPath,
		});

		// TODO: Explain that we had difficulty passing callbacks to remote worker API
		const onWordPressInstalled = await consumeAPI<() => Promise<void>>(
			process as NodeProcess
		);
		await onWordPressInstalled();
		await onWordPressInstalled[releaseRemoteApiProxy]();
	}

	async bootWorker(args: WorkerBootOptions) {
		// TODO: What about mounts after WP install?
		//       We add them to all HTTP server processes immediately
		//       after install. But what about spawned bin/php processes?
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
				createPhpRuntime: createPhpRuntimeFactory(options),
				onPHPInstanceCreated: async (php) => {
					await mountResources(php, options.mountsBeforeWpInstall);
				},
				sapiName: 'cli',
				cookieStore: false,
				spawnHandler: () =>
					sandboxedSpawnHandlerFactory(() =>
						createPHPWorker(options)
					),
				maxPhpInstances: 1,
			});
			this.__internal_setRequestHandler(requestHandler);

			const primaryPhp = await requestHandler.getPrimaryPhp();
			await this.setPrimaryPHP(primaryPhp);

			if (cluster.isWorker) {
				await startServer({
					port: options.port,
					handleRequest: async (request: PHPRequest) => {
						return await this.request(request);
					},
				});
			}

			setApiReady();
		} catch (e) {
			setAPIError(e as Error);
			throw e;
		}
	}

	async mountAfterWordPressInstall(mountsAfterWpInstall: Array<Mount>) {
		const primaryPhp =
			await this.__internal_getRequestHandler()!.getPrimaryPhp();
		await mountResources(primaryPhp, mountsAfterWpInstall);
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
function createPhpRuntimeFactory(options: WorkerBootRequestHandlerOptions) {
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
				},
				followSymlinks: options.followSymlinks,
				withIntl: options.withIntl,
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
 * @returns A promise that resolves to the PHP worker.
 */
async function createPHPWorker(options: WorkerBootRequestHandlerOptions) {
	const spawnedWorker = await spawnWorkerProcess('v1');

	const handler = consumeAPI<PlaygroundCliBlueprintV1Worker>(
		// TODO: Fix this type error.
		// @ts-ignore
		spawnedWorker
	);
	await handler.bootWorker(options);

	return {
		php: handler,
		reap: async () => {
			try {
				handler.dispose();
			} catch {
				/** */
			}
			try {
				await killWorkerProcess(spawnedWorker);
			} catch {
				/** */
			}
		},
	};
}

process.on('unhandledRejection', (e: any) => {
	logger.error('Unhandled rejection:', e);
});

const [setApiReady, setAPIError] = exposeAPI(
	new PlaygroundCliBlueprintV1Worker(new EmscriptenDownloadMonitor()),
	undefined,
	// TODO: Fix this type error.
	// @ts-ignore
	process as NodeProcess
);

process.send!({ command: 'worker-script-initialized' });
