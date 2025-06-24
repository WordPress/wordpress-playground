import type { PHP, SupportedPHPVersion } from '@php-wasm/universal';
import {
	PHPExecutionFailureError,
	PHPResponse,
	PHPWorker,
	consumeAPI,
	exposeAPI,
	sandboxedSpawnHandlerFactory,
} from '@php-wasm/universal';
import type { FileLockManager } from '@php-wasm/node';
import { createNodeFsMountHandler, loadNodeRuntime } from '@php-wasm/node';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { bootRequestHandler, bootWordPress } from '@wp-playground/wordpress';
import { sprintf } from '@php-wasm/util';
import { parentPort } from 'worker_threads';
import { rootCertificates } from 'tls';
import type { RunCLIArgs } from './run-cli';
import {
	type PHPExceptionDetails,
	runBlueprintV2,
} from '@wp-playground/blueprints';
import { errorLogPath, logger } from '@php-wasm/logger';
import { existsSync } from 'fs';
import path from 'path';
import type { Mount } from './mounts';

function mountResources(php: PHP, mounts: Mount[]) {
	for (const mount of mounts) {
		php.mkdir(mount.vfsPath);
		php.mount(mount.vfsPath, createNodeFsMountHandler(mount.hostPath));
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
 * Output writer that ensures that progress bars are not printed on the same line as other output.
 */
let output = {
	lastWriteWasProgress: false,
	progress(data: string) {
		if (!process.stdout.isTTY) {
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

export interface WorkerBootArgs extends RunCLIArgs {
	siteUrl: string;
	firstProcessId: number;
	processIdSpaceLength: number;
	trace: boolean;
}

interface WorkerRunBlueprintArgs extends RunCLIArgs {
	siteUrl: string;
}

interface WorkerBootRequestHandlerOptions {
	siteUrl: string;
	php: SupportedPHPVersion;
	allow?: string;
	firstProcessId: number;
	processIdSpaceLength: number;
	trace: boolean;
}

export class PlaygroundCliWorker extends PHPWorker {
	booted = false;

	constructor(monitor: EmscriptenDownloadMonitor) {
		super(undefined, monitor);
	}

	async bootAsPrimaryWorker(args: WorkerBootArgs) {
		await this.bootRequestHandler(args);

		const primaryPhp = this.__internal_getPHP()!;
		if (args.mode === 'mount-only') {
			mountResources(primaryPhp, args.mount || []);
			return;
		}

		await this.runBlueprintV2(args);
	}

	async bootAsSecondaryWorker(args: WorkerBootArgs) {
		await this.bootRequestHandler(args);
		const php = this.__internal_getPHP()!;
		// When secondary workers are spawned, WordPress is already installed.
		mountResources(php, args.mountBeforeInstall || []);
		mountResources(php, args.mount || []);
	}

	async runBlueprintV2(args: WorkerRunBlueprintArgs) {
		const requestHandler = this.__internal_getRequestHandler()!;
		const { php, reap } =
			await requestHandler.processManager.acquirePHPInstance({
				considerPrimary: false,
			});

		// Mount the current working directory to the PHP runtime for the purposes of
		// Blueprint resolution.
		let unmountCwd = () => {};
		if (typeof args.blueprint === 'string') {
			const blueprintPath = path.resolve(process.cwd(), args.blueprint);
			if (existsSync(blueprintPath)) {
				const primaryPhp = this.__internal_getPHP()!;
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

		let phpErrorReported = false;
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

			const php = this.__internal_getPHP()!;
			const streamedResponse = await runBlueprintV2({
				php,
				blueprint: args.blueprint,
				blueprintOverrides: {
					additionalSteps: args.additionalBlueprintSteps,
					wordpressVersion: args.wp,
				},
				cliArgs,
				hooks: {
					afterBlueprintTargetResolved: async () => {
						await mountResources(php, args.mount || []);
					},
					onProgress: (progress, caption) => {
						const message = `${caption.trim()} – ${progress.toFixed(
							2
						)}%`;
						output.progress(message);
					},
					onError: (message, details?: PHPExceptionDetails) => {
						phpErrorReported = true;
						const red = '\x1b[31m';
						const bold = '\x1b[1m';
						const reset = '\x1b[0m';
						if (args.debug && details) {
							output.stderr(
								`${red}${bold}Fatal error:${reset} Uncaught ${details.exception}: ${details.message}\n` +
									`  at ${details.file}:${details.line}\n` +
									(details.trace ? details.trace + '\n' : '')
							);
						} else {
							output.stderr(
								`${red}${bold}Error:${reset} ${message}\n`
							);
						}
					},
				},
			});
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
				throw new PHPExecutionFailureError(
					'Execution failed',
					await PHPResponse.fromStreamedResponse(streamedResponse),
					'request'
				);
			}
		} catch (error) {
			// @TODO: Rethink error handling here.
			if (!args.debug) {
				throw error;
			}
			let phpLogs = '';
			try {
				// @TODO: Don't assume errorLogPath starts with /wordpress/
				//        ...or maybe we can assume that in Playground CLI?
				phpLogs = php.readFileAsText(errorLogPath);
			} catch {
				phpLogs =
					'Unknown error – we could not even read the PHP error log.';
			}
			// @TODO: Without this console.error, we don't get the error details we need to debug.
			console.error(error);
			throw new Error(phpLogs, { cause: error });
		} finally {
			reap();
			unmountCwd();
		}
	}

	async bootRequestHandler({
		siteUrl,
		allow,
		php,
		firstProcessId,
		processIdSpaceLength,
		trace,
	}: WorkerBootRequestHandlerOptions) {
		if (this.booted) {
			throw new Error('Playground already booted');
		}
		this.booted = true;

		let nextProcessId = firstProcessId;
		const lastProcessId = firstProcessId + processIdSpaceLength - 1;
		const fileLockManager = consumeAPI<FileLockManager>(parentPort!);
		await fileLockManager.isConnected();

		try {
			const constants: Record<string, string | number | boolean | null> =
				{
					WP_DEBUG: true,
					WP_DEBUG_LOG: true,
					WP_DEBUG_DISPLAY: false,
				};

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

					return await loadNodeRuntime(php, {
						emscriptenOptions: {
							fileLockManager,
							processId,
							trace: trace ? tracePhpWasm : undefined,
							ENV: {
								DOCROOT: '/wordpress',
							},
						},
						followSymlinks: allow?.includes('follow-symlinks'),
					});
				},
				sapiName: 'cli',
				createFiles: {
					'/internal/shared/ca-bundle.crt':
						rootCertificates.join('\n'),
				},
				constants,
				phpIniEntries: {
					'openssl.cafile': '/internal/shared/ca-bundle.crt',
				},
				cookieStore: false,
				spawnHandler: (processManager) =>
					sandboxedSpawnHandlerFactory(processManager, {
						onError: (error) => {
							logger.error(error);
							output.stderr(`${error.message}\n`);
						},
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

const [setApiReady, setAPIError] = exposeAPI(
	new PlaygroundCliWorker(new EmscriptenDownloadMonitor()),
	undefined,
	parentPort!
);

// Confirm that the worker script has initialized.
parentPort!.postMessage('worker-script-initialized');
