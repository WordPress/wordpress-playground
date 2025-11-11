import { errorLogPath, logger } from '@php-wasm/logger';
import type { FileLockManager } from '@php-wasm/node';
import { createNodeFsMountHandler, loadNodeRuntime } from '@php-wasm/node';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import type {
	PHP,
	FileTree,
	RemoteAPI,
	SupportedPHPVersion,
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
import type { Mount } from '../mounts';
import { jspi } from 'wasm-feature-detect';
import { type RunCLIArgs } from '../run-cli';
import type {
	PhpIniOptions,
	PHPInstanceCreatedHook,
} from '@wp-playground/wordpress';

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
 * Force TTY status to preserve ANSI control codes in the output.
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
		if (output.lastWriteWasProgress) {
			process.stdout.write('\n');
			output.lastWriteWasProgress = false;
		}
		process.stdout.write(data);
	},
	stderr(data: string) {
		if (output.lastWriteWasProgress) {
			process.stdout.write('\n');
			output.lastWriteWasProgress = false;
		}
		process.stderr.write(data);
	},
};

export type PrimaryWorkerBootArgs = RunCLIArgs & {
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
};

type WorkerRunBlueprintArgs = RunCLIArgs & {
	siteUrl: string;
	blueprint:
		| RawBlueprintV2Data
		| ParsedBlueprintV2String
		| BlueprintV1Declaration;
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
	withXdebug?: boolean;
	mountsBeforeWpInstall?: Array<Mount>;
	mountsAfterWpInstall?: Array<Mount>;
};

export type WorkerBootRequestHandlerOptions = Omit<
	SecondaryWorkerBootArgs,
	'mountsBeforeWpInstall' | 'mountsAfterWpInstall'
> & {
	onPHPInstanceCreated: PHPInstanceCreatedHook;
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
				await mountResources(php, args['mount-before-install'] || []);
				if (this.blueprintTargetResolved) {
					await mountResources(php, args.mount || []);
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
		};
		await this.bootRequestHandler(requestHandlerOptions);

		const primaryPhp = this.__internal_getPHP()!;

		if (args.mode === 'mount-only') {
			await mountResources(primaryPhp, args.mount || []);
			return;
		}

		await this.runBlueprintV2(args);
	}

	async bootWorker(args: SecondaryWorkerBootArgs) {
		await this.bootRequestHandler({
			...args,
			onPHPInstanceCreated: async (php: PHP) => {
				await mountResources(php, args.mountsBeforeWpInstall || []);
				await mountResources(php, args.mountsAfterWpInstall || []);
			},
		});
	}

	async runBlueprintV2(args: WorkerRunBlueprintArgs) {
		const requestHandler = this.__internal_getRequestHandler()!;
		const { php, reap } =
			await requestHandler.processManager.acquirePHPInstance({
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
									await mountResources(php, args.mount || []);
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
							if (args.debug && message.details) {
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
			if (args.debug) {
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
				const syncResponse = await PHPResponse.fromStreamedResponse(
					streamedResponse
				);
				throw new PHPExecutionFailureError(
					`PHP.run() failed with exit code ${syncResponse.exitCode}.`,
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
		withXdebug,
		onPHPInstanceCreated,
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
						withXdebug,
					});
				},
				onPHPInstanceCreated,
				sapiName: 'cli',
				createFiles,
				constants,
				phpIniEntries,
				cookieStore: false,
				spawnHandler: sandboxedSpawnHandlerFactory,
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
