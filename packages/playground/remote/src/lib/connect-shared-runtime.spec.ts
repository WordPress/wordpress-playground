vi.mock('@php-wasm/web', () => ({ consumeAPI: () => ({}) }));
vi.mock('./shared-playground-worker.ts?worker&url', () => ({
	default: '/worker.js',
}));

import { connectSharedRuntime } from './connect-shared-runtime';
import { RELOAD_REQUIRED, RUNTIME_CLOSED } from './shared-runtime';

// Contract: independent tabs retire the previous owner before discovering a new one.
// Stale storage and concurrent startup can otherwise select different worker generations.
describe('shared runtime discovery across deployments', () => {
	let workers: MockWorker[];
	let postMessage: ReturnType<typeof vi.fn>;
	let storage: Map<string, string>;
	const key = 'playground:shared-worker:default';
	const identity = (version: string) => ({
		url: `https://example.test/worker.js?build=${version}`,
		name: `playground:default:${version}`,
		version,
	});

	class MockWorker extends EventTarget {
		url: string;
		name: string;
		port = Object.assign(new EventTarget(), {
			start: vi.fn(),
			close: vi.fn(),
			postMessage: vi.fn(),
		});
		constructor(url: string, options: WorkerOptions) {
			super();
			this.url = url;
			this.name = options.name!;
			workers.push(this);
		}
		send(data: unknown) {
			this.port.dispatchEvent(new MessageEvent('message', { data }));
		}
	}

	beforeEach(() => {
		vi.useFakeTimers();
		workers = [];
		storage = new Map();
		postMessage = vi.fn();
		vi.stubGlobal('SharedWorker', MockWorker);
		vi.stubGlobal(
			'window',
			Object.assign(new EventTarget(), { parent: { postMessage } })
		);
		vi.stubGlobal('location', {
			origin: 'https://example.test',
			href: 'https://example.test/remote.html',
		});
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => storage.set(key, value),
		});
		vi.stubGlobal('navigator', {
			serviceWorker: new EventTarget(),
		});
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('retires the recorded worker before connecting and recording the new identity', async () => {
		storage.set(key, JSON.stringify(identity('old')));
		const connection = connectSharedRuntime('default', 'new', 'new');
		expect(workers[0].url).toBe(identity('old').url);
		workers[0].send({ type: RELOAD_REQUIRED, ready: false });
		await vi.advanceTimersByTimeAsync(100);
		expect(workers).toHaveLength(1);
		expect(JSON.parse(storage.get(key)!)).toEqual(identity('old'));
		workers[0].send({ type: RUNTIME_CLOSED });
		await vi.advanceTimersByTimeAsync(0);
		expect(workers[0].port.close).toHaveBeenCalledOnce();
		expect(workers[1].url).toBe(identity('new').url);
		expect(workers[1].name).toBe(identity('new').name);
		workers[1].send({
			type: 'shared-runtime-connected',
			runtimeId: 'new-runtime',
		});
		const connected = await connection;
		expect(JSON.parse(storage.get(key)!)).toEqual(identity('new'));
		expect(postMessage).not.toHaveBeenCalled();
		workers[1].send({ type: 'shared-runtime-retired' });
		expect(connected.isRetired()).toBe(true);
		// Retirement itself must block old-tab interaction before another API call or navigation.
		expect(postMessage).toHaveBeenCalledWith(
			{ type: RELOAD_REQUIRED, ready: false },
			location.origin
		);
		workers[1].send({ type: RUNTIME_CLOSED });
		expect(postMessage).toHaveBeenLastCalledWith(
			{ type: RUNTIME_CLOSED },
			location.origin
		);
	});

	it('reuses a recorded current-build identity without retiring it', async () => {
		storage.set(key, JSON.stringify(identity('new')));
		const connection = connectSharedRuntime('default', 'new', 'new');
		expect(workers[0].name).toBe(identity('new').name);
		workers[0].send({
			type: 'shared-runtime-connected',
			runtimeId: 'existing',
		});
		await connection;
		expect(workers).toHaveLength(1);
	});

	it('probes the unversioned worker when no identity is recorded', async () => {
		const connection = connectSharedRuntime('default', 'new', 'new');
		expect(workers[0].name).toBe('playground:default');
		expect(workers[0].url).toBe('https://example.test/worker.js');
		workers[0].send({ type: RELOAD_REQUIRED, ready: true });
		await vi.advanceTimersByTimeAsync(0);
		workers[1].send({ type: 'shared-runtime-connected', runtimeId: 'new' });
		await connection;
	});

	it('allows two tabs to retire the same worker and choose the same replacement', async () => {
		storage.set(key, JSON.stringify(identity('old')));
		const first = connectSharedRuntime('default', 'new', 'new');
		const second = connectSharedRuntime('default', 'new', 'new');
		workers[0].send({ type: RELOAD_REQUIRED, ready: false });
		workers[1].send({ type: RELOAD_REQUIRED, ready: false });
		workers[0].send({ type: RUNTIME_CLOSED });
		workers[1].send({ type: RUNTIME_CLOSED });
		await vi.advanceTimersByTimeAsync(0);
		expect(workers[2].url).toBe(workers[3].url);
		expect(workers[2].name).toBe(workers[3].name);
		workers[2].send({
			type: 'shared-runtime-connected',
			runtimeId: 'shared',
		});
		workers[3].send({
			type: 'shared-runtime-connected',
			runtimeId: 'shared',
		});
		await Promise.all([first, second]);
		expect(JSON.parse(storage.get(key)!)).toEqual(identity('new'));
	});

	it('ignores an unavailable old worker and connects to the replacement', async () => {
		storage.set(key, JSON.stringify(identity('old')));
		const connection = connectSharedRuntime('default', 'new', 'new');
		workers[0].dispatchEvent(new Event('error'));
		await vi.advanceTimersByTimeAsync(0);
		workers[1].send({ type: 'shared-runtime-connected', runtimeId: 'new' });
		await connection;
	});

	it('does not bypass a confirmed save failure', async () => {
		const connection = connectSharedRuntime('default', 'new', 'new');
		const rejected = expect(connection).rejects.toThrow('disk full');
		workers[0].send({
			type: 'shared-runtime-retirement-error',
			error: 'disk full',
		});
		await rejected;
		expect(workers).toHaveLength(1);
		expect(postMessage).toHaveBeenCalledWith(
			{ type: RELOAD_REQUIRED, ready: false },
			location.origin
		);
	});

	it('does not start a replacement when a responding worker never confirms shutdown', async () => {
		const connection = connectSharedRuntime('default', 'new', 'new');
		const rejected = expect(connection).rejects.toThrow('timed out');
		workers[0].send({ type: RELOAD_REQUIRED, ready: false });
		await vi.advanceTimersByTimeAsync(30000);
		await rejected;
		expect(workers).toHaveLength(1);
		expect(storage.has(key)).toBe(false);
	});

	it('prompts stale documents without retiring or overwriting the current identity', async () => {
		storage.set(key, JSON.stringify(identity('new')));
		await expect(
			connectSharedRuntime('default', 'new', 'old')
		).rejects.toThrow(RELOAD_REQUIRED);
		expect(workers).toHaveLength(0);
		expect(JSON.parse(storage.get(key)!)).toEqual(identity('new'));
	});
});
