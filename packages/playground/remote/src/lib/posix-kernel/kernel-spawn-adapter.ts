/**
 * Natural FS-shaped facade over the `BrowserKernel` spawn API.
 *
 * `BrowserKernel` exposes process spawn (`kernel.spawn(programBytes,
 * argv, options)`) and an HTTP bridge, but the host cannot touch the
 * VFS once `kernelOwnedFs: true` is set in `boot.ts`. Every filesystem
 * mutation has to round-trip through a spawned `coreutils.wasm`
 * multicall binary inside the kernel — the same binary `vfs-builder.ts`
 * symlinks under `/bin/{cat,mkdir,rm,mv,ls,test,tee,...}`.
 *
 * Wrapping every kernel.spawn invocation behind a method named for the
 * underlying intent keeps `php-api.ts` readable: it calls
 * `adapter.writeFile(path, data)` rather than constructing argv and
 * juggling stdin/stdout buffers inline. The CLI's `KernelLimitedPHPApi`
 * sits on Node `fs`; the browser version sits on this adapter. Same
 * shape, different storage.
 *
 * Why this lives in its own module:
 *   1. `BrowserKernel.onStdout` / `onStderr` are constructor-time
 *      singletons — there is no per-pid routing. Coordinating with the
 *      capture hook from `boot.ts` is intricate enough that hiding it
 *      here is worth it.
 *   2. Spawns are serialized through `inFlight` so a second
 *      `adapter.writeFile` waits for the first to finish before
 *      installing its capture. Concurrent capture would corrupt both
 *      results.
 *   3. The wasm bytes for `coreutils` and `php` are heavy (megabytes);
 *      caching the `ArrayBuffer` slice on the adapter keeps every spawn
 *      from re-fetching them.
 */

import type { BrowserKernel } from './host-bridge';
import type { CaptureHandler } from './boot';

/**
 * Result of a single captured spawn. `stdout` / `stderr` are the
 * concatenated bytes the program emitted; `exitCode` is the kernel
 * exit status as reported by `kernel.spawn`'s resolved promise.
 */
export interface SpawnResult {
	exitCode: number;
	stdout: Uint8Array;
	stderr: Uint8Array;
}

/**
 * Options accepted by {@link KernelSpawnAdapter.runPhpCli} and the
 * private `spawnCapturing` helper. Mirrors the subset of the CLI's
 * `runtime.spawnCapturing` options reachable from blueprint v1's
 * `run` step.
 */
export interface RunPhpOptions {
	argv: string[];
	stdin?: Uint8Array;
	env?: string[];
	cwd?: string;
}

export interface KernelSpawnAdapterOptions {
	kernel: BrowserKernel;
	coreutilsBytes: ArrayBuffer;
	phpWasmBytes: ArrayBuffer;
	setCapture: (handler: CaptureHandler | null) => void;
}

export class KernelSpawnAdapter {
	private readonly kernel: BrowserKernel;
	private readonly coreutilsBytes: ArrayBuffer;
	private readonly phpWasmBytes: ArrayBuffer;
	private readonly setCapture: (h: CaptureHandler | null) => void;
	/**
	 * Serializes spawns. `BrowserKernel`'s `onStdout` / `onStderr` are
	 * constructor-time singletons, so two concurrent spawns would
	 * cross-contaminate captures. Every public method awaits this
	 * promise before installing its handler.
	 */
	private inFlight: Promise<unknown> = Promise.resolve();

	constructor(options: KernelSpawnAdapterOptions) {
		this.kernel = options.kernel;
		this.coreutilsBytes = options.coreutilsBytes;
		this.phpWasmBytes = options.phpWasmBytes;
		this.setCapture = options.setCapture;
	}

	async writeFile(path: string, data: string | Uint8Array): Promise<void> {
		const bytes =
			typeof data === 'string' ? new TextEncoder().encode(data) : data;
		const result = await this.runCoreutils(['tee', path], { stdin: bytes });
		if (result.exitCode !== 0) {
			throw new Error(
				`writeFile(${path}) failed (exit=${result.exitCode}): ` +
					decodeText(result.stderr)
			);
		}
	}

	async readFileAsBuffer(path: string): Promise<Uint8Array> {
		const result = await this.runCoreutils(['cat', path]);
		if (result.exitCode !== 0) {
			throw new Error(
				`readFileAsBuffer(${path}) failed (exit=${result.exitCode}): ` +
					decodeText(result.stderr)
			);
		}
		return result.stdout;
	}

	async readFileAsText(path: string): Promise<string> {
		return decodeText(await this.readFileAsBuffer(path));
	}

	/** `mkdir -p` — also satisfies `mkdirTree`. */
	async mkdir(path: string): Promise<void> {
		const result = await this.runCoreutils(['mkdir', '-p', path]);
		if (result.exitCode !== 0) {
			throw new Error(
				`mkdir(${path}) failed (exit=${result.exitCode}): ` +
					decodeText(result.stderr)
			);
		}
	}

	async unlink(path: string): Promise<void> {
		const result = await this.runCoreutils(['rm', '-f', path]);
		if (result.exitCode !== 0) {
			throw new Error(
				`unlink(${path}) failed (exit=${result.exitCode}): ` +
					decodeText(result.stderr)
			);
		}
	}

	async mv(fromPath: string, toPath: string): Promise<void> {
		const result = await this.runCoreutils(['mv', fromPath, toPath]);
		if (result.exitCode !== 0) {
			throw new Error(
				`mv(${fromPath} → ${toPath}) failed (exit=${result.exitCode}): ` +
					decodeText(result.stderr)
			);
		}
	}

	async rmdir(path: string, recursive: boolean): Promise<void> {
		const argv = recursive ? ['rm', '-rf', path] : ['rmdir', path];
		const result = await this.runCoreutils(argv);
		if (result.exitCode !== 0) {
			throw new Error(
				`rmdir(${path}, recursive=${recursive}) failed ` +
					`(exit=${result.exitCode}): ${decodeText(result.stderr)}`
			);
		}
	}

	/**
	 * `ls -1` returns one entry per line. Trailing newline is trimmed;
	 * empty lines (which only happen for an empty directory listing)
	 * are filtered out so the caller never sees `['']`.
	 */
	async listFiles(path: string): Promise<string[]> {
		const result = await this.runCoreutils(['ls', '-1', path]);
		if (result.exitCode !== 0) {
			throw new Error(
				`listFiles(${path}) failed (exit=${result.exitCode}): ` +
					decodeText(result.stderr)
			);
		}
		return decodeText(result.stdout)
			.split('\n')
			.filter((line) => line.length > 0);
	}

	/** `test -d` returns 0 if `path` is a directory, 1 otherwise. */
	async isDir(path: string): Promise<boolean> {
		const result = await this.runCoreutils(['test', '-d', path]);
		return result.exitCode === 0;
	}

	/** `test -e` returns 0 if `path` exists, 1 otherwise. */
	async fileExists(path: string): Promise<boolean> {
		const result = await this.runCoreutils(['test', '-e', path]);
		return result.exitCode === 0;
	}

	/**
	 * Spawn `php` inside the kernel and capture stdout/stderr/exit. The
	 * CLI's `KernelLimitedPHPApi.run()` calls `runtime.spawnCapturing`
	 * with the same shape; this is the browser equivalent.
	 */
	async runPhpCli(options: RunPhpOptions): Promise<SpawnResult> {
		return this.spawnCapturing(this.phpWasmBytes, options);
	}

	private async runCoreutils(
		argv: string[],
		options: { stdin?: Uint8Array } = {}
	): Promise<SpawnResult> {
		return this.spawnCapturing(this.coreutilsBytes, {
			argv,
			stdin: options.stdin,
		});
	}

	/**
	 * Core spawn-and-capture primitive. Installs a capture handler that
	 * accumulates stdout/stderr chunks until `kernel.spawn` resolves
	 * with the exit code, then uninstalls and returns the captured
	 * buffers. Serialized through `inFlight` because the capture slot
	 * is global.
	 *
	 * `programBytes` is sliced inside `BrowserKernel.spawn` (see
	 * `browser-kernel.ts:388`) so the same buffer can be reused for
	 * the next spawn — no need to slice here.
	 */
	private async spawnCapturing(
		programBytes: ArrayBuffer,
		options: RunPhpOptions
	): Promise<SpawnResult> {
		const previous = this.inFlight;
		let release: () => void = () => {
			/* replaced below */
		};
		this.inFlight = new Promise<void>((resolve) => {
			release = resolve;
		});
		try {
			await previous.catch(() => {
				/* prior spawn's failure shouldn't poison the queue */
			});

			const stdoutChunks: Uint8Array[] = [];
			const stderrChunks: Uint8Array[] = [];
			this.setCapture((chunk, stream) => {
				if (stream === 'stdout') {
					stdoutChunks.push(chunk);
				} else {
					stderrChunks.push(chunk);
				}
			});
			try {
				const exitCode = await this.kernel.spawn(
					programBytes,
					options.argv,
					{
						env: options.env,
						cwd: options.cwd,
						stdin: options.stdin,
					}
				);
				return {
					exitCode,
					stdout: concatChunks(stdoutChunks),
					stderr: concatChunks(stderrChunks),
				};
			} finally {
				this.setCapture(null);
			}
		} finally {
			release();
		}
	}
}

function decodeText(bytes: Uint8Array): string {
	return new TextDecoder().decode(bytes);
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
	let total = 0;
	for (const chunk of chunks) {
		total += chunk.length;
	}
	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.length;
	}
	return out;
}
