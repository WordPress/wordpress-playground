/**
 * Interactive PTY shell sessions on the kernel.
 *
 * Spawns `/bin/bash` (baked into the VFS by `vfs-builder.ts`; `/bin/sh`
 * stays dash) with a kernel PTY and routes the three PTY
 * primitives — output, input, winsize — between the kernel and the
 * Comlink endpoint. The website's terminal pane drives this through
 * `KernelPlaygroundWorkerEndpoint.startTerminal` / `writeToTerminal` /
 * `resizeTerminal`.
 *
 * Why this does NOT go through `KernelSpawnAdapter`: the adapter
 * serializes spawns and captures output through the singleton
 * `onStdout` / `onStderr` slot, because non-PTY output has no per-pid
 * routing. A PTY process is different — `kernel.onPtyOutput(pid, cb)`
 * routes by pid — so a long-lived shell can run alongside blueprint
 * spawns without touching the capture slot or the `inFlight` queue.
 *
 * `spawnFromVfs` (not `spawn`) because the shell binary already lives
 * in the kernel-owned VFS; shipping `bash.wasm` bytes from this worker
 * again would be redundant and the adapter's cached binaries don't
 * include it.
 */

/**
 * Structural slice of `BrowserKernel` the terminal uses. The
 * `@kandelo/*` module surface is declared `any` (see `kandelo.d.ts`),
 * so narrowing it here keeps this module and its tests typed.
 */
export interface TerminalKernel {
	spawnFromVfs(
		programPath: string,
		argv: string[],
		options?: {
			env?: string[];
			cwd?: string;
			pty?: boolean;
			ptyCols?: number;
			ptyRows?: number;
		}
	): Promise<{ pid: number; exit: Promise<number> }>;
	ptyWrite(pid: number, data: Uint8Array): void;
	ptyResize(pid: number, rows: number, cols: number): void;
	onPtyOutput(pid: number, callback: (data: Uint8Array) => void): void;
	clearPtyOutput(pid: number): void;
}

export interface TerminalSize {
	cols: number;
	rows: number;
}

const SHELL_PATH = '/bin/bash';
/**
 * `-i` forces interactive mode rather than relying on the shell's
 * isatty-based auto-detection — a mis-detection would read EOF and
 * exit before the user sees a prompt. `--rcfile` because the default
 * `~/.bashrc` cannot work here: kandelo mounts an empty scratch memfs
 * over `/root` on every boot, so the rc lives in `/etc` instead (see
 * `vfs-builder.ts:populateBashRc`).
 */
const SHELL_ARGV = ['bash', '--rcfile', '/etc/bashrc', '-i'];
/** Drop the user into the WordPress document root. */
const SHELL_CWD = '/var/www/html';
/**
 * Mirrors the env `boot.ts` hands dinit. The prompt and the color
 * aliases come from the `--rcfile` in {@link SHELL_ARGV}.
 */
const SHELL_ENV = [
	'HOME=/root',
	'TERM=xterm-256color',
	'PATH=/usr/local/bin:/usr/bin:/bin:/sbin:/usr/sbin',
];

export class KernelTerminalManager {
	private readonly kernel: TerminalKernel;
	/**
	 * Pids with a running shell. Guards `write` / `resize` so a call
	 * against an exited or never-started session fails with a named
	 * error instead of silently feeding a reused kernel pid.
	 */
	private readonly live = new Set<number>();

	constructor(kernel: TerminalKernel) {
		this.kernel = kernel;
	}

	/**
	 * Spawn a shell on a fresh PTY sized to the caller's terminal.
	 * `ptyCols` / `ptyRows` are passed pre-spawn so the first
	 * TIOCGWINSZ returns the real size instead of the kernel's 80x24
	 * default. Output that arrives before `onPtyOutput` registers is
	 * buffered by `BrowserKernel` and drained on registration.
	 */
	async start(
		size: TerminalSize,
		onOutput: (chunk: Uint8Array) => void,
		onExit: (code: number) => void
	): Promise<number> {
		const { pid, exit } = await this.kernel.spawnFromVfs(
			SHELL_PATH,
			SHELL_ARGV,
			{
				env: SHELL_ENV,
				cwd: SHELL_CWD,
				pty: true,
				ptyCols: size.cols,
				ptyRows: size.rows,
			}
		);
		this.live.add(pid);
		this.kernel.onPtyOutput(pid, onOutput);
		exit.then(
			(code) => {
				this.dispose(pid);
				onExit(code);
			},
			() => {
				// Kernel teardown rejects the exit promise; report the
				// conventional "killed" status rather than crashing the
				// worker with an unhandled rejection.
				this.dispose(pid);
				onExit(-1);
			}
		);
		return pid;
	}

	write(pid: number, data: Uint8Array): void {
		this.assertLive(pid, 'write');
		this.kernel.ptyWrite(pid, data);
	}

	resize(pid: number, rows: number, cols: number): void {
		this.assertLive(pid, 'resize');
		this.kernel.ptyResize(pid, rows, cols);
	}

	private dispose(pid: number): void {
		this.live.delete(pid);
		this.kernel.clearPtyOutput(pid);
	}

	private assertLive(pid: number, operation: string): void {
		if (!this.live.has(pid)) {
			throw new Error(
				`KernelTerminalManager.${operation}: no live terminal ` +
					`session for pid ${pid}.`
			);
		}
	}
}
