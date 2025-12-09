import type { FileLockManager } from '@php-wasm/node';
import { loadNodeRuntime } from '@php-wasm/node';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import type { RemoteAPI, SupportedPHPVersion } from '@php-wasm/universal';
import {
	PHPWorker,
	consumeAPI,
	consumeAPISync,
	exposeAPI,
} from '@php-wasm/universal';
import { createSpawnHandler, sprintf } from '@php-wasm/util';
import { RecommendedPHPVersion } from '@wp-playground/common';
import {
	type WordPressInstallMode,
	bootRequestHandler,
	bootWordPressAndRequestHandler,
} from '@wp-playground/wordpress';
import { rootCertificates } from 'tls';
import { jspi } from 'wasm-feature-detect';
import { MessageChannel, type MessagePort, parentPort } from 'worker_threads';
import { mountResources } from '../mounts';
import { logger } from '@php-wasm/logger';
import { spawn } from 'child_process';
import { type SpawnedWorker, spawnWorkerThread } from '../run-cli';

export interface Mount {
	hostPath: string;
	vfsPath: string;
}

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
	withXdebug?: boolean;
	nativeInternalDirPath: string;
};

export type PrimaryWorkerBootOptions = WorkerBootOptions & {
	wordpressInstallMode: WordPressInstallMode;
	wpVersion?: string;
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
	fileLockManager: RemoteAPI<FileLockManager> | FileLockManager | undefined;

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

	async bootAndSetUpInitialWorker(options: PrimaryWorkerBootOptions) {
		const {
			siteUrl,
			mountsBeforeWpInstall,
			mountsAfterWpInstall,
			phpVersion: php = RecommendedPHPVersion,
			wordpressInstallMode,
			wordPressZip,
			sqliteIntegrationPluginZip,
			firstProcessId,
			processIdSpaceLength,
			dataSqlPath,
			followSymlinks,
			trace,
			internalCookieStore,
			withXdebug,
			nativeInternalDirPath,
		} = options;
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
			let wordpressBooted = false;
			const requestHandler = await bootWordPressAndRequestHandler({
				siteUrl,
				createPhpRuntime: async () => {
					const processId = nextProcessId;

					if (nextProcessId < lastProcessId) {
						nextProcessId++;
					} else {
						// We've reached the end of the process ID space. Start over.
						nextProcessId = firstProcessId;
					}

					return await loadNodeRuntime(php, {
						emscriptenOptions: {
							fileLockManager: this.fileLockManager!,
							processId,
							trace: trace ? tracePhpWasm : undefined,
							phpWasmInitOptions: { nativeInternalDirPath },
						},
						followSymlinks,
						withXdebug,
					});
				},
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
				cookieStore: internalCookieStore ? undefined : false,
				dataSqlPath,
				spawnHandler: () =>
					createSpawnHandler(async (args, processApi, options) => {
						console.log('primary worker', { args });
						processApi.notifySpawn();
						if (args[0] === 'exec') {
							args.shift();
						}

						if (
							args[0].endsWith('.php') ||
							args[0].endsWith('.phar')
						) {
							args.unshift('php');
						}

						const binaryName = args[0].split('/').pop();
						if (binaryName !== 'php') {
							throw new Error(
								`Unsupported binary: ${binaryName}. Only PHP is supported for now.`
							);
						}

						const newPhpProcess = spawn(process.argv[0], args, {
							...options,
							stdio: ['pipe', 'pipe', 'pipe'],
						});
						const subPhpPort = await new Promise<MessagePort>(
							(resolve, reject) => {
								newPhpProcess.addListener(
									'message',
									(message: any) => {
										if (
											message.command ===
											'worker-script-initialized'
										) {
											resolve(message.phpPort);
										}
									}
								);
								newPhpProcess.once('error', (e: Error) => {
									reject(
										new Error(
											`Worker failed to initialize: ${e.message}`
										)
									);
								});
							}
						);

						const handler =
							consumeAPI<PlaygroundCliBlueprintV1Worker>(
								subPhpPort
							);
						handler.useFileLockManager(this.fileLockManager as any);
						await handler.bootWorker({
							phpVersion: php,
							siteUrl,
							mountsBeforeWpInstall,
							mountsAfterWpInstall,
							firstProcessId,
							processIdSpaceLength,
							followSymlinks,
							trace,
							nativeInternalDirPath,
						});

						handler.cli(['php', '-v']);
						console.log(await handler.hello());
					}),
				async onPHPInstanceCreated(php) {
					await mountResources(php, mountsBeforeWpInstall);
					if (wordpressBooted) {
						await mountResources(php, mountsAfterWpInstall);
					}
				},
			});
			this.__internal_setRequestHandler(requestHandler);
			wordpressBooted = true;

			const primaryPhp = await requestHandler.getPrimaryPhp();
			await this.setPrimaryPHP(primaryPhp);

			// The primary PHP instance is persistent, so we need to apply
			// post-install mounts now that WordPress has been booted.
			// All secondary PHP instances created after WP boot will get
			// these mounts automatically.
			await mountResources(primaryPhp, mountsAfterWpInstall);

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

	async bootRequestHandler({
		siteUrl,
		followSymlinks,
		phpVersion,
		firstProcessId,
		processIdSpaceLength,
		trace,
		nativeInternalDirPath,
		mountsBeforeWpInstall,
		mountsAfterWpInstall,
		withXdebug,
	}: WorkerBootRequestHandlerOptions) {
		if (this.booted) {
			throw new Error('Playground already booted');
		}
		this.booted = true;

		let nextProcessId = firstProcessId;
		const lastProcessId = firstProcessId + processIdSpaceLength - 1;

		try {
			const requestHandler = await bootRequestHandler({
				siteUrl,
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
							ENV: {
								DOCROOT: '/wordpress',
							},
							phpWasmInitOptions: { nativeInternalDirPath },
						},
						followSymlinks,
						withXdebug,
					});
				},
				onPHPInstanceCreated: async (php) => {
					await mountResources(php, mountsBeforeWpInstall);
					await mountResources(php, mountsAfterWpInstall);
				},
				sapiName: 'cli',
				cookieStore: false,
				spawnHandler: () =>
					createSpawnHandler(async (args, processApi) => {
						console.log('secondary worker', { args });
						if (args[0] === 'exec') {
							args.shift();
						}

						if (
							args[0].endsWith('.php') ||
							args[0].endsWith('.phar')
						) {
							args.unshift('php');
						}

						const binaryName = args[0].split('/').pop();
						if (binaryName !== 'php') {
							throw new Error(
								`Unsupported binary: ${binaryName}. Only PHP is supported for now.`
							);
						}

						let cliCalled = false;
						let spawnedWorker: SpawnedWorker | undefined =
							undefined;
						try {
							spawnedWorker = await spawnWorkerThread('v1', {
								onExit: () => {
									if (cliCalled) {
										// We're already handling the exit code using
										// the cliResponse.exitCode promise.
										return;
									}
									// The process died before we could call cli().
									// Let's exit with an error code.
									processApi.exit(1);
								},
							});
						} catch (e) {
							processApi.exit(1);
							throw e;
						}

						const handler =
							consumeAPI<PlaygroundCliBlueprintV1Worker>(
								spawnedWorker.phpPort
							);
						handler.useFileLockManager(this.fileLockManager as any);
						await handler.bootWorker({
							phpVersion: phpVersion,
							siteUrl,
							mountsBeforeWpInstall,
							mountsAfterWpInstall,
							firstProcessId,
							processIdSpaceLength,
							followSymlinks,
							trace,
							nativeInternalDirPath,
						});

						processApi.notifySpawn();

						const cliResponse = await handler.cli(args, {
							env: process.env as Record<string, string>,
						});
						cliResponse.stdout.pipeTo(
							new WritableStream({
								write(chunk) {
									processApi.stdout(chunk);
								},
							})
						);
						cliResponse.stderr.pipeTo(
							new WritableStream({
								write(chunk) {
									processApi.stderr(chunk);
								},
							})
						);
						await cliResponse.exitCode.finally(async () => {
							processApi.exit(await cliResponse.exitCode);
						});
						cliCalled = true;
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

	// Provide a named disposal method that can be invoked via comlink.
	async dispose() {
		await this[Symbol.asyncDispose]();
	}
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

console.log('Worker script initialized!');
