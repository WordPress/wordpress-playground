import { errorLogPath, logger } from '@php-wasm/logger';
import type { FileLockManager } from '@php-wasm/node';
import { createNodeFsMountHandler, loadNodeRuntime } from '@php-wasm/node';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import type {
	PHP,
	FileTree,
	RemoteAPI,
	SupportedPHPVersion,
	SpawnHandler,
} from '@php-wasm/universal';
import {
	PHPExecutionFailureError,
	PHPResponse,
	PHPWorker,
	consumeAPI,
	consumeAPISync,
	exposeAPI,
	sandboxedSpawnHandlerFactory,
} from '@php-wasm/universal';
import { sprintf } from '@php-wasm/util';
import {
	type BlueprintMessage,
	runBlueprintV2,
	type BlueprintV1Declaration,
} from '@wp-playground/blueprints';
import {
	type ParsedBlueprintV2String,
	type RawBlueprintV2Data,
} from '@wp-playground/blueprints';
import { bootRequestHandler } from '@wp-playground/wordpress';
import { existsSync } from 'fs';
import path from 'path';
import { rootCertificates } from 'tls';
import { MessageChannel, type MessagePort, parentPort } from 'worker_threads';
import { jspi } from 'wasm-feature-detect';
import { spawnWorkerThread, type RunCLIArgs } from '../run-cli';
import type {
	PhpIniOptions,
	PHPInstanceCreatedHook,
} from '@wp-playground/wordpress';
import { shouldRenderProgress } from '../utils/progress';
import type { Mount } from '@php-wasm/cli-util';

async function mountResources(php: PHP, mounts: Mount[]) {
	for (const mount of mounts) {
		try {
			php.mkdir(mount.vfsPath);
			await php.mount(
				mount.vfsPath,
				createNodeFsMountHandler(mount.hostPath)
			);
		} catch {
			output.stderr(
				`\x1b[31m\x1b[1mError mounting path ${mount.hostPath} at ${mount.vfsPath}\x1b[0m\n`
			);
			process.exit(1);
		}
	}
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
 * Force TTY status to preserve ANSI control codes in the output
 * when the environment is interactive.
 *
 * This script is spawned as `new Worker()` and process.stdout and process.stderr are
 * WritableWorkerStdio objects. By default, they strip ANSI control codes from the output
 * causing every progress bar update to be printed in a new line instead of updating the
 * same line.
 */
Object.defineProperty(process.stdout, 'isTTY', { value: true });
Object.defineProperty(process.stderr, 'isTTY', { value: true });

/**
 * Output writer that ensures that progress bars are not printed on the same line as other output.
 */
const output = {
	lastWriteWasProgress: false,
	progress(data: string) {
		if (!shouldRenderProgress(process.stdout)) {
			return;
		}
		if (!process.stdout.isTTY) {
			// eslint-disable-next-line no-console
			console.log(data);
		} else {
			if (!output.lastWriteWasProgress) {
				process.stdout.write('\n');
			}
			process.stdout.write('\r\x1b[K' + data);
			output.lastWriteWasProgress = true;
		}
	},
	stdout(data: string) {
		process.stdout.write('\n\n\n');
		if (output.lastWriteWasProgress) {
			output.lastWriteWasProgress = false;
		}
		process.stdout.write(data);
	},
	stderr(data: string) {
		process.stdout.write('\n\n\n');
		if (output.lastWriteWasProgress) {
			output.lastWriteWasProgress = false;
		}
		process.stderr.write(data);
	},
};

export type PrimaryWorkerBootArgs = Omit<
	RunCLIArgs,
	'mount-before-install' | 'mount'
> & {
	phpVersion: SupportedPHPVersion;
	siteUrl: string;
	firstProcessId: number;
	processIdSpaceLength: number;
	trace: boolean;
	blueprint:
		| RawBlueprintV2Data
		| ParsedBlueprintV2String
		| BlueprintV1Declaration;
	nativeInternalDirPath: string;
	mountsBeforeWpInstall?: Array<Mount>;
	mountsAfterWpInstall?: Array<Mount>;
};

type WorkerRunBlueprintArgs = Omit<
	RunCLIArgs,
	'mount-before-install' | 'mount'
> & {
	siteUrl: string;
	blueprint:
		| RawBlueprintV2Data
		| ParsedBlueprintV2String
		| BlueprintV1Declaration;
	mountsAfterWpInstall?: Array<Mount>;
};

export type SecondaryWorkerBootArgs = {
	siteUrl: string;
	allow?: string;
	phpVersion: SupportedPHPVersion;
	phpIniEntries?: PhpIniOptions;
	constants?: Record<string, string | number | boolean | null>;
	createFiles?: FileTree;
	firstProcessId: number;
	processIdSpaceLength: number;
	trace: boolean;
	nativeInternalDirPath: string;
	withIntl?: boolean;
	withXdebug?: boolean;
	mountsBeforeWpInstall?: Array<Mount>;
	mountsAfterWpInstall?: Array<Mount>;
};

export type WorkerBootRequestHandlerOptions = Omit<
	SecondaryWorkerBootArgs,
	'mountsBeforeWpInstall' | 'mountsAfterWpInstall'
> & {
	onPHPInstanceCreated: PHPInstanceCreatedHook;
	spawnHandler: () => SpawnHandler;
};

export class PlaygroundCliBlueprintV2Worker extends PHPWorker {
	booted = false;
	blueprintTargetResolved = false;
	phpInstancesThatNeedMountsAfterTargetResolved = new Set<PHP>();
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

	async bootAndSetUpInitialWorker(args: PrimaryWorkerBootArgs) {
		const constants = {
			WP_DEBUG: true,
			WP_DEBUG_LOG: true,
			WP_DEBUG_DISPLAY: false,
		};
		const requestHandlerOptions: WorkerBootRequestHandlerOptions = {
			...args,
			createFiles: {
				'/internal/shared/ca-bundle.crt': rootCertificates.join('\n'),
			},
			constants,
			phpIniEntries: {
				'openssl.cafile': '/internal/shared/ca-bundle.crt',
			},
			onPHPInstanceCreated: async (php: PHP) => {
				await mountResources(php, args.mountsBeforeWpInstall || []);
				if (this.blueprintTargetResolved) {
					await mountResources(php, args.mountsAfterWpInstall || []);
				} else {
					// NOTE: Today (2025-09-11), during boot with a plugin auto-mount,
					// the Blueprint runner fails unless post-resolution mounts are
					// added to existing PHP instances. So we track them here so they
					// can be mounted at the necessary time.
					// Only plugin auto-mounts seem to need this, so perhaps there
					// is a change we can make to the Blueprint runner so such
					// a dance is unnecessary.
					this.phpInstancesThatNeedMountsAfterTargetResolved.add(php);
					php.addEventListener('runtime.beforeExit', () => {
						this.phpInstancesThatNeedMountsAfterTargetResolved.delete(
							php
						);
					});
				}
			},
			spawnHandler: () =>
				sandboxedSpawnHandlerFactory(() =>
					createPHPWorker(args, this.fileLockManager!)
				),
		};
		await this.bootRequestHandler(requestHandlerOptions);

		const primaryPhp = this.__internal_getPHP()!;

		if (args.mode === 'mount-only') {
			await mountResources(primaryPhp, args.mountsAfterWpInstall || []);
			return;
		}

		await this.runBlueprintV2({
			...args,
			mountsAfterWpInstall: args.mountsAfterWpInstall || [],
		});
	}

	async bootWorker(args: SecondaryWorkerBootArgs) {
		await this.bootRequestHandler({
			...args,
			onPHPInstanceCreated: async (php: PHP) => {
				await mountResources(php, args.mountsBeforeWpInstall || []);
				await mountResources(php, args.mountsAfterWpInstall || []);

				// Temporary workaround for LOCK_EX in sqlite-database-integration.
				// Creation of these files results in this error:
				// PHP Warning:  file_put_contents(): Exclusive locks are not supported for this stream
				// in
				// /wordpress/wp-content/plugins/sqlite-database-integration/wp-includes/sqlite/class-wp-sqlite-db.php
				// on line 670
				if (!php.isDir('/wordpress/wp-content')) {
					php.mkdir('/wordpress/wp-content');
				}
				if (!php.isDir('/wordpress/wp-content/database')) {
					php.mkdir('/wordpress/wp-content/database');
				}
				if (!php.isFile('/wordpress/wp-content/database/.htaccess')) {
					php.writeFile(
						'/wordpress/wp-content/database/.htaccess',
						'deny from all'
					);
				}
				if (!php.isFile('/wordpress/wp-content/database/index.php')) {
					php.writeFile(
						'/wordpress/wp-content/database/index.php',
						'deny from all'
					);
				}
			},
			spawnHandler: () =>
				sandboxedSpawnHandlerFactory(() =>
					createPHPWorker(args, this.fileLockManager!)
				),
		});
	}

	async runBlueprintV2(args: WorkerRunBlueprintArgs) {
		const requestHandler = this.__internal_getRequestHandler()!;
		const { php, reap } =
			await requestHandler.instanceManager.acquirePHPInstance({
				considerPrimary: false,
			});

		// Mount the current working directory to the PHP runtime for the purposes of
		// Blueprint resolution.
		const primaryPhp = this.__internal_getPHP()!;
		let unmountCwd = () => {};
		if (typeof args.blueprint === 'string') {
			const blueprintPath = path.resolve(process.cwd(), args.blueprint);
			if (existsSync(blueprintPath)) {
				primaryPhp.mkdir('/internal/shared/cwd');
				unmountCwd = await primaryPhp.mount(
					'/internal/shared/cwd',
					createNodeFsMountHandler(path.dirname(blueprintPath))
				);
				args.blueprint = path.join(
					'/internal/shared/cwd',
					path.basename(args.blueprint)
				);
			}
		}

		try {
			const cliArgsToPass: (keyof WorkerRunBlueprintArgs)[] = [
				'mode',
				'db-engine',
				'db-host',
				'db-user',
				'db-pass',
				'db-name',
				'db-path',
				'truncate-new-site-directory',
				'allow',
			];
			const cliArgs = cliArgsToPass
				.filter((arg) => arg in args)
				.map((arg) => `--${arg}=${args[arg]}`);
			cliArgs.push(`--site-url=${args.siteUrl}`);

			const streamedResponse = await runBlueprintV2({
				php,
				blueprint: args.blueprint,
				blueprintOverrides: {
					additionalSteps: args['additional-blueprint-steps'],
					wordpressVersion: args.wp,
				},
				cliArgs,
				onMessage: async (message: BlueprintMessage) => {
					switch (message.type) {
						case 'blueprint.target_resolved': {
							if (!this.blueprintTargetResolved) {
								this.blueprintTargetResolved = true;
								for (const php of this
									.phpInstancesThatNeedMountsAfterTargetResolved) {
									// console.log('mounting resources for php', php);
									this.phpInstancesThatNeedMountsAfterTargetResolved.delete(
										php
									);
									await mountResources(
										php,
										args.mountsAfterWpInstall || []
									);
								}
							}
							break;
						}
						case 'blueprint.progress': {
							const progressMessage = `${message.caption.trim()} – ${message.progress.toFixed(
								2
							)}%`;
							output.progress(progressMessage);
							break;
						}
						case 'blueprint.error': {
							const red = '\x1b[31m';
							const bold = '\x1b[1m';
							const reset = '\x1b[0m';
							if (args.verbosity === 'debug' && message.details) {
								output.stderr(
									`${red}${bold}Fatal error:${reset} Uncaught ${message.details.exception}: ${message.details.message}\n` +
										`  at ${message.details.file}:${message.details.line}\n` +
										(message.details.trace
											? message.details.trace + '\n'
											: '')
								);
							} else {
								output.stderr(
									`${red}${bold}Error:${reset} ${message.message}\n`
								);
							}
							break;
						}
					}
				},
			});
			/**
			 * When we're debugging, every bit of information matters – let's immediately output
			 * everything we get from the PHP output streams.
			 */
			if (args.verbosity === 'debug') {
				streamedResponse!.stdout.pipeTo(
					new WritableStream({
						write(chunk) {
							process.stdout.write(chunk);
						},
					})
				);
				streamedResponse!.stderr.pipeTo(
					new WritableStream({
						write(chunk) {
							process.stderr.write(chunk);
						},
					})
				);
			}
			await streamedResponse!.finished;
			if ((await streamedResponse!.exitCode) !== 0) {
				// exitCode != 1 means the blueprint execution failed. Let's throw an error.
				// and clean up.
				const syncResponse =
					await PHPResponse.fromStreamedResponse(streamedResponse);
				throw new PHPExecutionFailureError(
					`PHP.run() failed with exit code ${syncResponse.exitCode}. ${syncResponse.errors} ${syncResponse.text}`,
					syncResponse,
					'request'
				);
			}
		} catch (error) {
			// Capture the PHP error log details to provide more context for debugging.
			let phpLogs = '';
			try {
				// @TODO: Don't assume errorLogPath starts with /wordpress/
				//        ...or maybe we can assume that in Playground CLI?
				phpLogs = php.readFileAsText(errorLogPath);
			} catch {
				// Ignore errors reading the PHP error log.
			}
			(error as any).phpLogs = phpLogs;
			throw error;
		} finally {
			reap();
			unmountCwd();
		}
	}

	async bootRequestHandler({
		siteUrl,
		allow,
		phpVersion,
		createFiles,
		constants,
		phpIniEntries,
		firstProcessId,
		processIdSpaceLength,
		trace,
		nativeInternalDirPath,
		withIntl,
		withXdebug,
		onPHPInstanceCreated,
		spawnHandler,
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
						followSymlinks: allow?.includes('follow-symlinks'),
						withIntl: withIntl,
						withXdebug,
					});
				},
				maxPhpInstances: 1,
				onPHPInstanceCreated,
				sapiName: 'cli',
				createFiles,
				constants,
				phpIniEntries,
				cookieStore: false,
				spawnHandler,
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
	{
		siteUrl,
		allow,
		phpVersion,
		createFiles,
		constants,
		phpIniEntries,
		firstProcessId,
		processIdSpaceLength,
		trace,
		nativeInternalDirPath,
		withXdebug,
		mountsBeforeWpInstall,
		mountsAfterWpInstall,
	}: SecondaryWorkerBootArgs,
	fileLockManager: FileLockManager | RemoteAPI<FileLockManager>
) {
	const spawnedWorker = await spawnWorkerThread('v2');

	const handler = consumeAPI<PlaygroundCliBlueprintV2Worker>(
		spawnedWorker.phpPort
	);
	handler.useFileLockManager(fileLockManager as any);
	await handler.bootWorker({
		siteUrl,
		allow,
		phpVersion,
		createFiles,
		constants,
		phpIniEntries,
		firstProcessId,
		processIdSpaceLength,
		trace,
		nativeInternalDirPath,
		withXdebug,
		mountsBeforeWpInstall,
		mountsAfterWpInstall,
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
