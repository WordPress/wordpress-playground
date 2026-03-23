import { describe, it, expect, vi, afterEach } from 'vitest';
import type * as PhpWasmLoggerModule from '@php-wasm/logger';
import os from 'os';
import {
	computeWorkerCount,
	ESTIMATED_WORKER_MEMORY_BYTES,
} from '../src/run-cli';

vi.mock('@php-wasm/logger', async (importOriginal) => {
	const actual = await importOriginal<typeof PhpWasmLoggerModule>();
	return {
		...actual,
		logger: { log: vi.fn(), error: vi.fn(), debug: vi.fn() },
	};
});

describe('computeWorkerCount', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns minWorkers when free memory is very low', () => {
		vi.spyOn(os, 'freemem').mockReturnValue(50 * 1024 * 1024); // 50MB
		expect(computeWorkerCount(2, 12)).toBe(2);
	});

	it('returns maxWorkers when free memory is very high', () => {
		vi.spyOn(os, 'freemem').mockReturnValue(100 * 1024 * 1024 * 1024); // 100GB
		expect(computeWorkerCount(2, 12)).toBe(12);
	});

	it('returns memory-based count when between min and max', () => {
		// 800MB free -> 400MB budget -> 4 workers
		vi.spyOn(os, 'freemem').mockReturnValue(800 * 1024 * 1024);
		expect(computeWorkerCount(2, 12)).toBe(4);
	});

	it('clamps to minWorkers even when memory suggests fewer', () => {
		// 300MB free -> 150MB budget -> 1 worker, but min is 4
		vi.spyOn(os, 'freemem').mockReturnValue(300 * 1024 * 1024);
		expect(computeWorkerCount(4, 8)).toBe(4);
	});

	it('clamps to maxWorkers even when memory suggests more', () => {
		// 4GB free -> 2GB budget -> 20 workers, but max is 8
		vi.spyOn(os, 'freemem').mockReturnValue(4 * 1024 * 1024 * 1024);
		expect(computeWorkerCount(2, 8)).toBe(8);
	});

	it('uses 50% of free memory divided by estimated worker size', () => {
		const freeMem = 1200 * 1024 * 1024; // 1200MB
		vi.spyOn(os, 'freemem').mockReturnValue(freeMem);
		const expected = Math.floor(
			(freeMem * 0.5) / ESTIMATED_WORKER_MEMORY_BYTES
		);
		expect(computeWorkerCount(1, 100)).toBe(expected);
		expect(expected).toBe(6);
	});
});
