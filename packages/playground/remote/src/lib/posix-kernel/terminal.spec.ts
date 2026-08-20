import { describe, expect, it } from 'vitest';

import { KernelTerminalManager } from './terminal';
import type { TerminalKernel } from './terminal';

interface SpawnRecord {
	programPath: string;
	argv: string[];
	options: {
		env?: string[];
		cwd?: string;
		pty?: boolean;
		ptyCols?: number;
		ptyRows?: number;
	};
}

function makeKernel(pid = 4242) {
	const spawns: SpawnRecord[] = [];
	const writes: Array<{ pid: number; data: Uint8Array }> = [];
	const resizes: Array<{ pid: number; rows: number; cols: number }> = [];
	const cleared: number[] = [];
	const outputCallbacks = new Map<number, (data: Uint8Array) => void>();
	let resolveExit!: (code: number) => void;
	let rejectExit!: (error: Error) => void;
	const exit = new Promise<number>((resolve, reject) => {
		resolveExit = resolve;
		rejectExit = reject;
	});
	const kernel: TerminalKernel = {
		async spawnFromVfs(programPath, argv, options = {}) {
			spawns.push({ programPath, argv, options });
			return { pid, exit };
		},
		ptyWrite(pid, data) {
			writes.push({ pid, data });
		},
		ptyResize(pid, rows, cols) {
			resizes.push({ pid, rows, cols });
		},
		onPtyOutput(pid, callback) {
			outputCallbacks.set(pid, callback);
		},
		clearPtyOutput(pid) {
			cleared.push(pid);
		},
	};
	return {
		kernel,
		spawns,
		writes,
		resizes,
		cleared,
		outputCallbacks,
		resolveExit,
		rejectExit,
	};
}

describe('KernelTerminalManager', () => {
	it('spawns an interactive shell on a PTY sized to the caller', async () => {
		const { kernel, spawns, outputCallbacks } = makeKernel(101);
		const manager = new KernelTerminalManager(kernel);
		const chunks: Uint8Array[] = [];

		const pid = await manager.start(
			{ cols: 120, rows: 30 },
			(chunk) => chunks.push(chunk),
			() => {}
		);

		expect(pid).toBe(101);
		expect(spawns).toHaveLength(1);
		expect(spawns[0].programPath).toBe('/bin/bash');
		expect(spawns[0].options.pty).toBe(true);
		expect(spawns[0].options.ptyCols).toBe(120);
		expect(spawns[0].options.ptyRows).toBe(30);

		outputCallbacks.get(101)!(new Uint8Array([36, 32]));
		expect(chunks).toEqual([new Uint8Array([36, 32])]);
	});

	it('routes write and resize to the session pid', async () => {
		const { kernel, writes, resizes } = makeKernel(7);
		const manager = new KernelTerminalManager(kernel);
		const pid = await manager.start(
			{ cols: 80, rows: 24 },
			() => {},
			() => {}
		);

		manager.write(pid, new Uint8Array([108, 115, 10]));
		manager.resize(pid, 40, 132);

		expect(writes).toEqual([
			{ pid: 7, data: new Uint8Array([108, 115, 10]) },
		]);
		expect(resizes).toEqual([{ pid: 7, rows: 40, cols: 132 }]);
	});

	it('reports the exit code, clears PTY state, and rejects further writes', async () => {
		const { kernel, cleared, resolveExit } = makeKernel(9);
		const manager = new KernelTerminalManager(kernel);
		let exitCode: number | undefined;
		const pid = await manager.start(
			{ cols: 80, rows: 24 },
			() => {},
			(code) => {
				exitCode = code;
			}
		);

		resolveExit(3);
		await Promise.resolve();

		expect(exitCode).toBe(3);
		expect(cleared).toEqual([9]);
		expect(() => manager.write(pid, new Uint8Array([10]))).toThrow(
			'no live terminal session for pid 9'
		);
	});

	it('maps a rejected exit promise to code -1', async () => {
		const { kernel, rejectExit } = makeKernel(11);
		const manager = new KernelTerminalManager(kernel);
		let exitCode: number | undefined;
		await manager.start(
			{ cols: 80, rows: 24 },
			() => {},
			(code) => {
				exitCode = code;
			}
		);

		rejectExit(new Error('kernel torn down'));
		await Promise.resolve();

		expect(exitCode).toBe(-1);
	});

	it('rejects writes to a pid it never started', () => {
		const { kernel } = makeKernel();
		const manager = new KernelTerminalManager(kernel);
		expect(() => manager.write(1, new Uint8Array([10]))).toThrow(
			'no live terminal session for pid 1'
		);
	});
});
