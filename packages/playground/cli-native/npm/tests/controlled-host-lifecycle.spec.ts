import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter, once } from 'node:events';
import { createConnection } from 'node:net';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerControlledHost } from '../src/controlled-host-lifecycle.js';

type FixtureEvent = {
	event: string;
	generation?: number;
	pid?: number;
	port?: number;
	baseline?: ListenerCounts;
	listenerCounts?: ListenerCounts;
};

type ListenerCounts = Record<'exit' | 'SIGINT' | 'SIGTERM', number>;

class FakeChild extends EventEmitter {
	exitCode: number | null = null;
	signalCode: NodeJS.Signals | null = null;
	pid: number | undefined = 12_345;
	kill = vi.fn(() => true);
}

type Fixture = {
	child: ChildProcess;
	events: AsyncIterator<string>;
	exit: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
	stderr: () => string;
	hostPids: Set<number>;
};

const fixtures = new Set<Fixture>();

afterEach(async () => {
	await Promise.all(Array.from(fixtures, (fixture) => forceStop(fixture)));
	fixtures.clear();
});

describe.sequential('controlled native host process lifecycle', () => {
	it('deduplicates registrations and removes every listener on release', () => {
		const child = new FakeChild();
		const baseline = listenerCounts();
		const childExitListeners = child.listenerCount('exit');
		const releaseFirst = registerControlledHost(
			child as unknown as ChildProcess
		);
		const releaseSecond = registerControlledHost(
			child as unknown as ChildProcess
		);

		expect(listenerCounts()).toEqual(incremented(baseline));
		expect(child.listenerCount('exit')).toBe(childExitListeners + 1);
		releaseFirst();
		releaseFirst();
		expect(listenerCounts()).toEqual(incremented(baseline));
		expect(child.listenerCount('exit')).toBe(childExitListeners + 1);
		releaseSecond();
		expect(listenerCounts()).toEqual(baseline);
		expect(child.listenerCount('exit')).toBe(childExitListeners);
	});

	it('shares one registry and hook set across duplicate module instances', async () => {
		const baseline = listenerCounts();
		const first = new FakeChild();
		const releaseFirst = registerControlledHost(
			first as unknown as ChildProcess
		);
		vi.resetModules();
		const duplicateModule =
			await import('../src/controlled-host-lifecycle.js');
		const second = new FakeChild();
		second.pid = 12_346;
		const releaseSecond = duplicateModule.registerControlledHost(
			second as unknown as ChildProcess
		);

		expect(listenerCounts()).toEqual(incremented(baseline));
		expect(first.listenerCount('exit')).toBe(1);
		expect(second.listenerCount('exit')).toBe(1);
		releaseFirst();
		expect(listenerCounts()).toEqual(incremented(baseline));
		releaseSecond();
		expect(listenerCounts()).toEqual(baseline);
	});

	it('sends at most one termination request across repeated exit cleanup', () => {
		const child = new FakeChild();
		const baselineExitListeners = new Set(process.listeners('exit'));
		const release = registerControlledHost(
			child as unknown as ChildProcess
		);
		const exitHook = process
			.listeners('exit')
			.find((listener) => !baselineExitListeners.has(listener));
		if (!exitHook) throw new Error('missing controlled-host exit hook');
		exitHook(1);
		exitHook(1);
		expect(child.kill).toHaveBeenCalledOnce();
		expect(child.kill).toHaveBeenCalledWith('SIGTERM');
		release();
	});

	it('keeps a live child registered after an error without exit', () => {
		const child = new FakeChild();
		const baseline = listenerCounts();
		child.on('error', () => {});
		const release = registerControlledHost(
			child as unknown as ChildProcess
		);
		child.emit('error', new Error('non-fatal child error'));
		expect(listenerCounts()).toEqual(incremented(baseline));
		release();
		expect(listenerCounts()).toEqual(baseline);
	});

	it('removes its registry entry and listeners when the host exits itself', () => {
		const child = new FakeChild();
		const baseline = listenerCounts();
		const release = registerControlledHost(
			child as unknown as ChildProcess
		);
		expect(listenerCounts()).toEqual(incremented(baseline));
		child.exitCode = 0;
		child.emit('exit', 0, null);
		expect(listenerCounts()).toEqual(baseline);
		release();
		expect(listenerCounts()).toEqual(baseline);
	});

	it('kills the host PID and closes its port after a fatal uncaught exception', async () => {
		const fixture = launchFixture('fatal-exception');
		const started = await nextEvent(fixture, 'started');
		writeCommand(fixture, 'throw');
		const result = await fixture.exit;
		expect(result.code).toBe(1);
		expect(result.signal).toBeNull();
		await expectHostStopped(started);
	});

	it.each(['SIGINT', 'SIGTERM'] as const)(
		'kills the host and preserves default parent %s termination',
		async (signal) => {
			const fixture = launchFixture(`default-${signal}`);
			const started = await nextEvent(fixture, 'started');
			fixture.child.kill(signal);
			const result = await fixture.exit;
			const fallbackCode = signal === 'SIGINT' ? 130 : 143;
			expect(
				result.signal === signal || result.code === fallbackCode
			).toBe(true);
			await expectHostStopped(started);
		}
	);

	it('keeps the host alive when the consumer handles an exception', async () => {
		const fixture = launchFixture('handled-exception');
		const started = await nextEvent(fixture, 'started');
		writeCommand(fixture, 'throw');
		await nextEvent(fixture, 'handled-exception');
		await expectHostAlive(started);
		writeCommand(fixture, 'dispose');
		const disposed = await nextEvent(fixture, 'disposed');
		expect(disposed.listenerCounts).toEqual(started.baseline);
		await expectHostStopped(started);
		writeCommand(fixture, 'quit');
		await expect(fixture.exit).resolves.toEqual({ code: 0, signal: null });
	});

	it('defers to a consumer signal handler without killing its host', async () => {
		const fixture = launchFixture('handled-signal');
		const started = await nextEvent(fixture, 'started');
		fixture.child.kill('SIGTERM');
		await nextEvent(fixture, 'handled-signal');
		await expectHostAlive(started);
		writeCommand(fixture, 'dispose');
		await nextEvent(fixture, 'disposed');
		await expectHostStopped(started);
		writeCommand(fixture, 'quit');
		await expect(fixture.exit).resolves.toEqual({ code: 0, signal: null });
	});

	it('defers to a pre-existing one-shot signal handler', async () => {
		const fixture = launchFixture('handled-once-signal');
		const started = await nextEvent(fixture, 'started');
		fixture.child.kill('SIGTERM');
		await nextEvent(fixture, 'handled-signal');
		await expectHostAlive(started);
		writeCommand(fixture, 'dispose');
		await nextEvent(fixture, 'disposed');
		await expectHostStopped(started);
		writeCommand(fixture, 'quit');
		await expect(fixture.exit).resolves.toEqual({ code: 0, signal: null });
	});

	it('supports ordinary disposal, listener cleanup, and a fresh host', async () => {
		const fixture = launchFixture('normal');
		const first = await nextEvent(fixture, 'started');
		expect(first.listenerCounts).toEqual(incremented(first.baseline!));
		writeCommand(fixture, 'dispose');
		const firstDisposed = await nextEvent(fixture, 'disposed');
		expect(firstDisposed.listenerCounts).toEqual(first.baseline);
		await expectHostStopped(first);

		writeCommand(fixture, 'start');
		const second = await nextEvent(fixture, 'started');
		expect(second.generation).toBe(2);
		expect(second.listenerCounts).toEqual(incremented(second.baseline!));
		await expectHostAlive(second);
		writeCommand(fixture, 'dispose');
		const secondDisposed = await nextEvent(fixture, 'disposed');
		expect(secondDisposed.listenerCounts).toEqual(second.baseline);
		await expectHostStopped(second);
		writeCommand(fixture, 'quit');
		await expect(fixture.exit).resolves.toEqual({ code: 0, signal: null });
	});
});

function launchFixture(scenario: string): Fixture {
	const viteNode = fileURLToPath(
		new URL(
			'../../../../../node_modules/vite-node/vite-node.mjs',
			import.meta.url
		)
	);
	const fixturePath = fileURLToPath(
		new URL('./fixtures/controlled-host-parent.ts', import.meta.url)
	);
	const child = spawn(process.execPath, [viteNode, fixturePath, scenario], {
		stdio: ['pipe', 'pipe', 'pipe'],
		windowsHide: true,
	});
	if (!child.stdout || !child.stderr || !child.stdin)
		throw new Error('fixture stdio is unavailable');
	const lines = createInterface({ input: child.stdout });
	let stderr = '';
	child.stderr.on('data', (chunk: Buffer) => {
		stderr = `${stderr}${chunk}`.slice(-16_384);
	});
	const fixture: Fixture = {
		child,
		events: lines[Symbol.asyncIterator](),
		exit: new Promise((resolvePromise, reject) => {
			child.once('error', reject);
			child.once('exit', (code, signal) =>
				resolvePromise({ code, signal })
			);
		}),
		stderr: () => stderr,
		hostPids: new Set(),
	};
	fixtures.add(fixture);
	return fixture;
}

async function nextEvent(
	fixture: Fixture,
	event: string
): Promise<FixtureEvent> {
	for (;;) {
		const result = await withTimeout(fixture.events.next(), 10_000);
		if (result.done)
			throw new Error(
				`fixture exited before ${event}; stderr: ${fixture.stderr()}`
			);
		let parsed: FixtureEvent;
		try {
			parsed = JSON.parse(result.value) as FixtureEvent;
		} catch {
			continue;
		}
		if (typeof parsed.pid === 'number') fixture.hostPids.add(parsed.pid);
		if (parsed.event === event) return parsed;
	}
}

function writeCommand(fixture: Fixture, command: string): void {
	fixture.child.stdin?.write(`${command}\n`);
}

async function expectHostAlive(event: FixtureEvent): Promise<void> {
	if (event.pid === undefined || event.port === undefined)
		throw new Error('fixture did not report its host address');
	expect(processExists(event.pid)).toBe(true);
	expect(await portIsOpen(event.port)).toBe(true);
}

async function expectHostStopped(event: FixtureEvent): Promise<void> {
	if (event.pid === undefined || event.port === undefined)
		throw new Error('fixture did not report its host address');
	await vi.waitFor(
		async () => {
			expect(processExists(event.pid!)).toBe(false);
			expect(await portIsOpen(event.port!)).toBe(false);
		},
		{ timeout: 5_000, interval: 25 }
	);
}

function processExists(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
		throw error;
	}
}

function portIsOpen(port: number): Promise<boolean> {
	return new Promise((resolvePromise) => {
		const socket = createConnection({ host: '127.0.0.1', port });
		const finish = (open: boolean) => {
			socket.destroy();
			resolvePromise(open);
		};
		socket.setTimeout(250, () => finish(false));
		socket.once('connect', () => finish(true));
		socket.once('error', () => finish(false));
	});
}

function listenerCounts(): ListenerCounts {
	return {
		exit: process.listenerCount('exit'),
		SIGINT: process.listenerCount('SIGINT'),
		SIGTERM: process.listenerCount('SIGTERM'),
	};
}

function incremented(counts: ListenerCounts): ListenerCounts {
	return {
		exit: counts.exit + 1,
		SIGINT: counts.SIGINT + 1,
		SIGTERM: counts.SIGTERM + 1,
	};
}

async function forceStop(fixture: Fixture): Promise<void> {
	if (fixture.child.exitCode === null && fixture.child.signalCode === null) {
		try {
			fixture.child.kill('SIGKILL');
		} catch {
			// It may already have exited.
		}
		await Promise.race([
			fixture.exit.catch(() => undefined),
			new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000)),
		]);
	}
	for (const pid of fixture.hostPids) {
		if (!processExists(pid)) continue;
		try {
			process.kill(pid, 'SIGKILL');
		} catch {
			// It may already have exited.
		}
	}
}

async function withTimeout<T>(
	promise: Promise<T>,
	timeout: number
): Promise<T> {
	let timer: NodeJS.Timeout | undefined;
	try {
		return await Promise.race([
			promise,
			new Promise<never>((_resolvePromise, reject) => {
				timer = setTimeout(
					() =>
						reject(
							new Error(`fixture timed out after ${timeout}ms`)
						),
					timeout
				);
			}),
		]);
	} finally {
		if (timer !== undefined) clearTimeout(timer);
	}
}
