import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { PassThrough } from 'node:stream';
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

import {
	parseNativeCLIArgs,
	spawnNativeCLI,
	waitForChild,
} from '../src/process.js';

class FakeChild extends EventEmitter {
	kill = vi.fn(() => true);
	stdout = new PassThrough();
	stderr = new PassThrough();
}

async function waitForProbeSpawn(): Promise<void> {
	await vi.waitFor(() => expect(mocks.spawn).toHaveBeenCalledOnce());
}

function finishProbe(
	child: FakeChild,
	stdout: string | Buffer,
	options: {
		stderr?: string | Buffer;
		code?: number | null;
		signal?: NodeJS.Signals | null;
	} = {}
): void {
	child.stdout.end(stdout);
	child.stderr.end(options.stderr ?? '');
	child.emit(
		'close',
		options.code === undefined ? 0 : options.code,
		options.signal ?? null
	);
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

describe('native argv parser probe', () => {
	it('invokes the private probe and returns a validated valid result', async () => {
		const child = new FakeChild();
		mocks.spawn.mockReturnValue(child);
		const parsing = parseNativeCLIArgs(
			['server', '--port', '9400', '--site-url', 'https://example.test'],
			{ cwd: '/site' }
		);
		await waitForProbeSpawn();
		finishProbe(
			child,
			JSON.stringify({
				schemaVersion: 1,
				status: 'valid',
				command: 'server',
				port: 9400,
				siteUrl: 'https://example.test',
			}) + '\n'
		);

		await expect(parsing).resolves.toEqual({
			status: 'valid',
			command: 'server',
			port: 9400,
			siteUrl: 'https://example.test',
		});
		expect(mocks.spawn).toHaveBeenCalledWith(
			'/cache/wp-playground-native',
			[
				'--experimental-parse-argv-json',
				'server',
				'--port',
				'9400',
				'--site-url',
				'https://example.test',
			],
			expect.objectContaining({
				cwd: '/site',
				stdio: ['ignore', 'pipe', 'pipe'],
			})
		);
	});

	it('returns a validated invalid result', async () => {
		const child = new FakeChild();
		mocks.spawn.mockReturnValue(child);
		const parsing = parseNativeCLIArgs(['server', '--port', 'invalid']);
		await waitForProbeSpawn();
		finishProbe(
			child,
			JSON.stringify({
				schemaVersion: 1,
				status: 'invalid',
				exitCode: 1,
				message: 'invalid value for --port',
			})
		);
		await expect(parsing).resolves.toEqual({
			status: 'invalid',
			exitCode: 1,
			message: 'invalid value for --port',
		});
	});

	it.each([
		['malformed JSON', '{'],
		[
			'an extra key',
			JSON.stringify({
				schemaVersion: 1,
				status: 'valid',
				command: 'server',
				port: null,
				siteUrl: null,
				extra: true,
			}),
		],
		[
			'an unknown command',
			JSON.stringify({
				schemaVersion: 1,
				status: 'valid',
				command: 'php',
				port: null,
				siteUrl: null,
			}),
		],
		[
			'a command that does not match the request',
			JSON.stringify({
				schemaVersion: 1,
				status: 'valid',
				command: 'start',
				port: null,
				siteUrl: null,
			}),
		],
		[
			'an invalid port type',
			JSON.stringify({
				schemaVersion: 1,
				status: 'valid',
				command: 'server',
				port: '9400',
				siteUrl: null,
			}),
		],
		[
			'an invalid site URL type',
			JSON.stringify({
				schemaVersion: 1,
				status: 'valid',
				command: 'server',
				port: null,
				siteUrl: 42,
			}),
		],
		[
			'the wrong invalid exit code',
			JSON.stringify({
				schemaVersion: 1,
				status: 'invalid',
				exitCode: 2,
				message: 'bad argv',
			}),
		],
	] as const)('rejects %s as a protocol error', async (_label, output) => {
		const child = new FakeChild();
		mocks.spawn.mockReturnValue(child);
		const parsing = parseNativeCLIArgs(['server']);
		await waitForProbeSpawn();
		finishProbe(child, output);
		await expect(parsing).rejects.toMatchObject({
			name: 'NativeCLIError',
			code: 'ERR_WP_PLAYGROUND_NATIVE_PROTOCOL',
		});
	});

	it('rejects nonzero exits with bounded, redacted diagnostics', async () => {
		const child = new FakeChild();
		mocks.spawn.mockReturnValue(child);
		const parsing = parseNativeCLIArgs(['server']);
		await waitForProbeSpawn();
		finishProbe(child, '', {
			stderr: 'token=SUPER_SECRET',
			code: 7,
		});
		const error = await parsing.catch((cause: unknown) => cause);
		expect(error).toMatchObject({
			name: 'NativeCLIError',
			code: 'ERR_WP_PLAYGROUND_NATIVE_SPAWN',
			details: { exitCode: 7 },
		});
		expect((error as Error).message).toContain('stderr 18 bytes');
		expect((error as Error).message).not.toContain('SUPER_SECRET');
	});

	it('rejects unexpected successful stderr without exposing it', async () => {
		const child = new FakeChild();
		mocks.spawn.mockReturnValue(child);
		const parsing = parseNativeCLIArgs(['server']);
		await waitForProbeSpawn();
		finishProbe(
			child,
			JSON.stringify({
				schemaVersion: 1,
				status: 'valid',
				command: 'server',
				port: null,
				siteUrl: null,
			}),
			{ stderr: 'SUPER_SECRET' }
		);
		const error = await parsing.catch((cause: unknown) => cause);
		expect(error).toMatchObject({
			code: 'ERR_WP_PLAYGROUND_NATIVE_PROTOCOL',
		});
		expect((error as Error).message).not.toContain('SUPER_SECRET');
	});

	it('rejects signal termination as a spawn error', async () => {
		const child = new FakeChild();
		mocks.spawn.mockReturnValue(child);
		const parsing = parseNativeCLIArgs(['server']);
		await waitForProbeSpawn();
		finishProbe(child, '', { code: null, signal: 'SIGKILL' });
		await expect(parsing).rejects.toMatchObject({
			name: 'NativeCLIError',
			code: 'ERR_WP_PLAYGROUND_NATIVE_SPAWN',
			details: { signal: 'SIGKILL' },
		});
	});

	it.each([
		['stdout', 16 * 1024 + 1],
		['stderr', 4 * 1024 + 1],
	] as const)('enforces the %s byte bound', async (streamName, size) => {
		const child = new FakeChild();
		mocks.spawn.mockReturnValue(child);
		const parsing = parseNativeCLIArgs(['server']);
		await waitForProbeSpawn();
		finishProbe(child, streamName === 'stdout' ? Buffer.alloc(size) : '', {
			stderr: streamName === 'stderr' ? Buffer.alloc(size) : undefined,
		});
		await expect(parsing).rejects.toMatchObject({
			name: 'NativeCLIError',
			code: 'ERR_WP_PLAYGROUND_NATIVE_PROTOCOL',
			message: expect.stringContaining('exceeded its output limit'),
		});
		expect(child.kill).toHaveBeenCalledOnce();
	});

	it('removes signal, child, and stream listeners after probe failure', async () => {
		const child = new FakeChild();
		mocks.spawn.mockReturnValue(child);
		const sigintListeners = process.listenerCount('SIGINT');
		const sigtermListeners = process.listenerCount('SIGTERM');
		const parsing = parseNativeCLIArgs(['server']);
		await waitForProbeSpawn();
		finishProbe(child, '', { code: 9 });
		await expect(parsing).rejects.toMatchObject({
			code: 'ERR_WP_PLAYGROUND_NATIVE_SPAWN',
		});
		expect(process.listenerCount('SIGINT')).toBe(sigintListeners);
		expect(process.listenerCount('SIGTERM')).toBe(sigtermListeners);
		expect(child.listenerCount('error')).toBe(0);
		expect(child.listenerCount('close')).toBe(0);
		expect(child.stdout.listenerCount('data')).toBe(0);
		expect(child.stderr.listenerCount('data')).toBe(0);
	});
});
