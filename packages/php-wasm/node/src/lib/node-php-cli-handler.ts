import { spawn } from 'child_process';
import type { PHPCliHandler, ProcessOptions } from '@php-wasm/universal';
import type { ProcessApi } from '@php-wasm/util';
import { consumeAPI } from '@php-wasm/universal';
import type { MessagePort } from 'worker_threads';

/**
 * Result of running a PHP subprocess.
 */
export interface PhpSubprocessResult {
	stdout: Uint8Array;
	stderr: Uint8Array;
	exitCode: number;
}

/**
 * Options for running a PHP subprocess.
 */
export interface PhpSubprocessOptions {
	cwd?: string;
	env?: Record<string, string>;
}

/**
 * Manager for spawning PHP subprocesses.
 *
 * This class runs in the main process and handles subprocess spawning
 * on behalf of worker threads. Workers communicate with this manager
 * via MessagePort using Comlink.
 */
export class PhpSubprocessManager {
	private phpWasmEntryPoint: string;
	private nodePath: string;
	private nodeArgs: string[];

	constructor(options: {
		phpWasmEntryPoint: string;
		nodePath?: string;
		nodeArgs?: string[];
	}) {
		this.phpWasmEntryPoint = options.phpWasmEntryPoint;
		this.nodePath = options.nodePath ?? process.execPath;
		this.nodeArgs = options.nodeArgs ?? [];
	}

	/**
	 * Run a PHP CLI command as a subprocess.
	 *
	 * @param args - The PHP CLI arguments (without 'php' prefix)
	 * @param options - Subprocess options
	 * @returns The subprocess result with stdout, stderr, and exit code
	 */
	async runCli(
		args: string[],
		options: PhpSubprocessOptions = {}
	): Promise<PhpSubprocessResult> {
		return new Promise((resolve) => {
			const child = spawn(
				this.nodePath,
				[...this.nodeArgs, this.phpWasmEntryPoint, ...args],
				{
					cwd: options.cwd,
					env: {
						...process.env,
						...options.env,
						// Set SHELL_PIPE to 0 to ensure WP-CLI formats
						// the output as ASCII tables.
						// @see https://github.com/wp-cli/wp-cli/issues/1102
						SHELL_PIPE: '0',
					},
					stdio: ['pipe', 'pipe', 'pipe'],
				}
			);

			const stdoutChunks: Buffer[] = [];
			const stderrChunks: Buffer[] = [];

			child.stdout?.on('data', (chunk: Buffer) => {
				stdoutChunks.push(chunk);
			});

			child.stderr?.on('data', (chunk: Buffer) => {
				stderrChunks.push(chunk);
			});

			child.on('close', (code) => {
				resolve({
					stdout: new Uint8Array(Buffer.concat(stdoutChunks)),
					stderr: new Uint8Array(Buffer.concat(stderrChunks)),
					exitCode: code ?? 0,
				});
			});

			child.on('error', (error) => {
				resolve({
					stdout: new Uint8Array(),
					stderr: new TextEncoder().encode(
						`Failed to spawn PHP process: ${error.message}\n`
					),
					exitCode: 1,
				});
			});
		});
	}
}

/**
 * Creates a PHP CLI handler that communicates with a PhpSubprocessManager
 * running in the main process via a MessagePort.
 *
 * This is used in worker threads where we can't spawn subprocesses directly.
 * Instead, we send a message to the main process which spawns the subprocess
 * and returns the result.
 *
 * @param port - MessagePort connected to a PhpSubprocessManager in the main process
 * @returns A PHPCliHandler that can be used with createPhpSpawnHandler
 *
 * @example
 * ```ts
 * // In main process:
 * const manager = new PhpSubprocessManager({
 *   phpWasmEntryPoint: '/path/to/php-wasm/cli/main.js',
 * });
 * exposeAPI(manager, null, port1);
 *
 * // In worker:
 * const phpCliHandler = createRemotePhpCliHandler(port2);
 * const spawnHandler = createPhpSpawnHandler({
 *   getPrimaryPhp: () => requestHandler.getPrimaryPhp(),
 *   phpCliHandler,
 * });
 * ```
 */
export function createRemotePhpCliHandler(port: MessagePort): PHPCliHandler {
	const manager = consumeAPI<PhpSubprocessManager>(port);

	return async (
		args: string[],
		processApi: ProcessApi,
		processOptions: ProcessOptions
	) => {
		// Skip 'php' from args since the manager invokes php-wasm CLI directly
		const phpArgs = args.slice(1);

		const result = await manager.runCli(phpArgs, {
			cwd: processOptions.cwd,
			env: processOptions.env,
		});

		// Send output to the process API
		if (result.stdout.length > 0) {
			processApi.stdout(result.stdout);
		}
		if (result.stderr.length > 0) {
			processApi.stderr(result.stderr);
		}

		processApi.exit(result.exitCode);
	};
}

/**
 * Creates a PHP CLI handler that spawns subprocesses directly.
 *
 * This should only be used in the main process, not in worker threads.
 * For worker threads, use createRemotePhpCliHandler instead.
 *
 * @param options - Configuration options
 * @returns A PHPCliHandler that can be used with createPhpSpawnHandler
 */
export function createNodePhpCliHandler(options: {
	phpWasmEntryPoint: string;
	nodePath?: string;
	nodeArgs?: string[];
}): PHPCliHandler {
	const manager = new PhpSubprocessManager(options);

	return async (
		args: string[],
		processApi: ProcessApi,
		processOptions: ProcessOptions
	) => {
		// Skip 'php' from args since we're invoking the php-wasm CLI directly
		const phpArgs = args.slice(1);

		const result = await manager.runCli(phpArgs, {
			cwd: processOptions.cwd,
			env: processOptions.env,
		});

		// Send output to the process API
		if (result.stdout.length > 0) {
			processApi.stdout(result.stdout);
		}
		if (result.stderr.length > 0) {
			processApi.stderr(result.stderr);
		}

		processApi.exit(result.exitCode);
	};
}
