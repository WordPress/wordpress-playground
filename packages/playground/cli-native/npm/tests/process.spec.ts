import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	ensureNativeHost: vi.fn(),
	spawn: vi.fn(),
}));

vi.mock('../src/host.js', () => ({
	ensureNativeHost: mocks.ensureNativeHost,
}));

vi.mock('node:child_process', async () => {
	const actual =
		await vi.importActual<typeof import('node:child_process')>(
			'node:child_process'
		);
	return { ...actual, spawn: mocks.spawn };
});

import { spawnNativeCLI, waitForChild } from '../src/process.js';

class FakeChild extends EventEmitter {
	kill = vi.fn(() => true);
}

beforeEach(() => {
	mocks.ensureNativeHost.mockReset().mockResolvedValue({
		executablePath: '/cache/wp-playground-native',
		assetRoot: '/package/share/wp-playground-native',
	});
	mocks.spawn.mockReset();
});

describe('native child process mechanics', () => {
	it('forwards argv, cwd, environment, and stdio to the verified host', async () => {
		const child = new FakeChild();
		mocks.spawn.mockReturnValue(child);
		const result = await spawnNativeCLI({
			argv: ['server', '--port', '0'],
			cwd: '/site',
			env: { NATIVE_PROCESS_TEST: 'yes' },
			stdio: 'pipe',
		});
		expect(result).toBe(child);
		expect(mocks.spawn).toHaveBeenCalledWith(
			'/cache/wp-playground-native',
			['server', '--port', '0'],
			expect.objectContaining({
				cwd: '/site',
				stdio: 'pipe',
				windowsHide: true,
				env: expect.objectContaining({
					NATIVE_PROCESS_TEST: 'yes',
					WP_PLAYGROUND_NATIVE_ASSET_ROOT:
						'/package/share/wp-playground-native',
					WP_PLAYGROUND_NATIVE_DISABLE_SOURCE_FALLBACK: '1',
				}),
			})
		);
	});

	it('forwards termination signals and removes parent listeners on close', async () => {
		const child = new FakeChild();
		const sigintListeners = process.listenerCount('SIGINT');
		const sigtermListeners = process.listenerCount('SIGTERM');
		const waiting = waitForChild(child as unknown as ChildProcess);
		process.emit('SIGTERM');
		expect(child.kill).toHaveBeenCalledWith('SIGTERM');
		child.emit('close', null, 'SIGTERM');
		await expect(waiting).resolves.toEqual({
			code: null,
			signal: 'SIGTERM',
		});
		expect(process.listenerCount('SIGINT')).toBe(sigintListeners);
		expect(process.listenerCount('SIGTERM')).toBe(sigtermListeners);
	});

	it('rejects spawn errors and removes parent listeners', async () => {
		const child = new FakeChild();
		const sigintListeners = process.listenerCount('SIGINT');
		const sigtermListeners = process.listenerCount('SIGTERM');
		const waiting = waitForChild(child as unknown as ChildProcess);
		child.emit('error', new Error('spawn failed'));
		await expect(waiting).rejects.toThrow('spawn failed');
		expect(process.listenerCount('SIGINT')).toBe(sigintListeners);
		expect(process.listenerCount('SIGTERM')).toBe(sigtermListeners);
	});
});
