import { describe, it, expect, vi, afterEach } from 'vitest';
import type * as PhpWasmLoggerModule from '@php-wasm/logger';
import { logger } from '@php-wasm/logger';
import os from 'os';
import {
	warnIfInsufficientMemoryForWorkers,
	ESTIMATED_WORKER_MEMORY_BYTES,
} from '../src/run-cli';

vi.mock('@php-wasm/logger', async (importOriginal) => {
	const actual = await importOriginal<typeof PhpWasmLoggerModule>();
	return {
		...actual,
		logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
	};
});

describe('warnIfInsufficientMemoryForWorkers', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('logs a warning when selected workers exceed memory-based recommendation', () => {
		vi.spyOn(os, 'freemem').mockReturnValue(50 * 1024 * 1024); // 50MB
		const warnSpy = vi.spyOn(logger, 'warn');
		warnIfInsufficientMemoryForWorkers(2);
		expect(warnSpy).toHaveBeenCalledTimes(1);
	});

	it('logs an info message when selected workers fit memory budget', () => {
		// 800MB free -> 400MB budget -> 4 workers recommended
		vi.spyOn(os, 'freemem').mockReturnValue(800 * 1024 * 1024);
		const logSpy = vi.spyOn(logger, 'log');
		warnIfInsufficientMemoryForWorkers(4);
		expect(logSpy).toHaveBeenCalledTimes(1);
	});

	it('uses 50% of free memory divided by estimated worker size', () => {
		const freeMemory = 1200 * 1024 * 1024; // 1200MB
		vi.spyOn(os, 'freemem').mockReturnValue(freeMemory);
		const expectedRecommendation = Math.floor(
			(freeMemory * 0.5) / ESTIMATED_WORKER_MEMORY_BYTES
		);
		const warnSpy = vi.spyOn(logger, 'warn');
		warnIfInsufficientMemoryForWorkers(expectedRecommendation + 1);
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				`recommended max: ${expectedRecommendation}`
			)
		);
		expect(expectedRecommendation).toBe(6);
	});
});
