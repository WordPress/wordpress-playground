import { afterEach, describe, expect, test, vi } from 'vitest';

import { shouldRespawnWithExnref } from '../../src/posix-kernel/ensure-exnref';

const originalArgv = process.argv;
const originalExecArgv = process.execArgv;

describe('shouldRespawnWithExnref', () => {
	afterEach(() => {
		process.argv = originalArgv;
		process.execArgv = originalExecArgv;
		delete (process.versions as Record<string, string | undefined>)['bun'];
		vi.unstubAllGlobals();
	});

	test('requests the flag when --experimental-posix-kernel is used', () => {
		process.argv = [
			'node',
			'cli.js',
			'server',
			'--experimental-posix-kernel',
		];
		process.execArgv = [];
		expect(shouldRespawnWithExnref()).toBe(true);
	});

	test('requests the flag when the value form is used', () => {
		process.argv = [
			'node',
			'cli.js',
			'server',
			'--experimental-posix-kernel=true',
		];
		process.execArgv = [];
		expect(shouldRespawnWithExnref()).toBe(true);
	});

	test('leaves other commands alone', () => {
		process.argv = ['node', 'cli.js', 'server', '--php=8.3'];
		process.execArgv = [];
		expect(shouldRespawnWithExnref()).toBe(false);
	});

	test('does not respawn again once the flag is applied', () => {
		process.argv = [
			'node',
			'cli.js',
			'server',
			'--experimental-posix-kernel',
		];
		process.execArgv = ['--experimental-wasm-exnref'];
		expect(shouldRespawnWithExnref()).toBe(false);
	});
});
