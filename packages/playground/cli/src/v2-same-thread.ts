import { errorLogPath } from '@php-wasm/logger';
import type { FileLockManager } from '@php-wasm/node';
import { createNodeFsMountHandler, loadNodeRuntime } from '@php-wasm/node';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import type { PHP, SupportedPHPVersion } from '@php-wasm/universal';
import {
	PHPExecutionFailureError,
	PHPResponse,
	PHPWorker,
	consumeAPI,
	exposeAPI,
	sandboxedSpawnHandlerFactory,
} from '@php-wasm/universal';
import { sprintf } from '@php-wasm/util';
import { runBlueprintV2, type BlueprintMessage } from './v2';
import { bootRequestHandler } from '@wp-playground/wordpress';
import { existsSync } from 'fs';
import path from 'path';
import { rootCertificates } from 'tls';
import { parentPort } from 'worker_threads';
import type { Mount } from './mounts';
import type { RunCLIArgs } from './run-cli';

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
		await mountResources(primaryPhp, args['mount-before-install'] || []);

		if (args.mode === 'mount-only') {
			await mountResources(primaryPhp, args.mount || []);
			return;
		}

		await this.runBlueprintV2(args);
	}

	async bootAsSecondaryWorker(args: WorkerBootArgs) {
		await this.bootRequestHandler(args);
		const primaryPhp = this.__internal_getPHP()!;
		// When secondary workers are spawned, WordPress is already installed.
		await mountResources(primaryPhp, args['mount-before-install'] || []);
		await mountResources(primaryPhp, args.mount || []);
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

			let afterBlueprintTargetResolvedCalled = false;

			const streamedResponse = await runBlueprintV2({
				php,
				blueprint: args.blueprint,
				blueprintOverrides: {
					additionalSteps: args['additional-blueprint-steps'],
					wordpressVersion: args.wp,
				},
				cliArgs,
				onMessage: async (message: BlueprintMessage) => {
					// console.log("onMessage", message);
					switch (message.type) {
						case 'blueprint.target_resolved': {
							if (!afterBlueprintTargetResolvedCalled) {
								await mountResources(
									primaryPhp,
									args.mount || []
								);
								afterBlueprintTargetResolvedCalled = true;
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
							// process.stdout.write(
							// 	`\n1chunk: ${typeof chunk} ${
							// 		chunk.length
							// 	} ${new TextDecoder().decode(chunk)}`
							// );
						},
					})
				);
				streamedResponse!.stderr.pipeTo(
					new WritableStream({
						write(chunk) {
							// process.stderr.write(`\n2chunk: `);
							// process.stderr.write(typeof chunk);
							// process.stderr.write(`${chunk.length}`);
							// process.stderr.write(chunk);
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
			console.log('Reaping finally');
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
				spawnHandler: sandboxedSpawnHandlerFactory,
			});
			this.__internal_setRequestHandler(requestHandler);

			const primaryPhp = await requestHandler.getPrimaryPhp();
			await this.setPrimaryPHP(primaryPhp);
		} catch (e) {
			throw e;
		}
	}

	// Provide a named disposal method that can be invoked via comlink.
	async dispose() {
		await this[Symbol.asyncDispose]();
	}
}

const w = new PlaygroundCliWorker(new EmscriptenDownloadMonitor());

w.bootAsPrimaryWorker({
	siteUrl: 'http://127.0.0.1:9463',
	mode: 'create-new-site',
	command: 'run-blueprint',
	blueprint:
		'/Users/cloudnik/www/Automattic/core/plugins/playground/tmp/test-cli-integration/blueprints/e1d73a3ac5a0be5e256de34f3a0608b2.json',
	debug: true,
	php: '8.0',
	allow: 'read-local-fs',
	'truncate-new-site-directory': true,
	firstProcessId: 0,
	processIdSpaceLength: 1,
	trace: false,
	'mount-before-install': [
		{
			hostPath: import.meta.dirname + '/../../../../tmp/slash-tmp',
			vfsPath: '/tmp',
		},
	],
	// trace: true,
});
