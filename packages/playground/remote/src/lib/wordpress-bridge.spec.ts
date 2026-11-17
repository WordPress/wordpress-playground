import { MessageChannel as NodeMessageChannel } from 'node:worker_threads';
import type { MessagePort as NodeMessagePort } from 'node:worker_threads';

vi.mock('./config', () => ({
	playgroundOrigin: 'https://playground.test',
}));
vi.mock('virtual:remote-config', () => ({ buildVersion: 'new-release' }));

type TestWorker = EventTarget & {
	state: string;
	postMessage: ReturnType<typeof vi.fn>;
};
const testWorker = (state: string): TestWorker =>
	Object.assign(new EventTarget(), { state, postMessage: vi.fn() });

describe('WordPress helper worker updates', () => {
	let registration: {
		active: TestWorker | null;
		installing: TestWorker | null;
		waiting: TestWorker | null;
		update: ReturnType<typeof vi.fn<() => Promise<void>>>;
	};
	let postMessage: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.resetModules();
		registration = {
			active: testWorker('activated'),
			installing: null,
			waiting: null,
			update: vi.fn(async () => {}),
		};
		postMessage = vi.fn();
		vi.stubGlobal('location', {
			href: 'https://wp.playground.test/wordpress-bridge-b.html?scope=test',
			origin: 'https://wp.playground.test',
		});
		vi.stubGlobal('navigator', {
			serviceWorker: {
				register: vi.fn().mockResolvedValue(registration),
				getRegistration: vi.fn().mockResolvedValue(registration),
				ready: Promise.resolve(registration),
				addEventListener: vi.fn(),
			},
		});
		vi.stubGlobal('window', {
			parent: { postMessage },
			addEventListener: vi.fn(),
		});
		vi.stubGlobal('MessageChannel', NodeMessageChannel);
	});

	afterEach(() => vi.unstubAllGlobals());

	it('bypasses a previous release cached by the CDN at the unversioned worker URL', async () => {
		await import('./wordpress-bridge');
		expect(navigator.serviceWorker.register).toHaveBeenCalledWith(
			new URL(
				'https://wp.playground.test/sw.js?build-version=new-release'
			),
			{ type: 'module', updateViaCache: 'none' }
		);
	});

	it('waits for the update check and replacement activation with an existing registration', async () => {
		// Model register() returning release A's already-active registration.
		// B is not exposed as installing until its network update check finishes.
		const replacement = testWorker('installing');
		const listen = vi.spyOn(replacement, 'addEventListener');
		let finishUpdate!: () => void;
		registration.update.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					finishUpdate = () => {
						registration.installing = replacement;
						resolve();
					};
				})
		);
		const startup = import('./wordpress-bridge');
		await vi.waitFor(() =>
			expect(registration.update).toHaveBeenCalledOnce()
		);
		expect(postMessage).not.toHaveBeenCalled();
		finishUpdate();
		await vi.waitFor(() => expect(listen).toHaveBeenCalled());
		expect(postMessage).not.toHaveBeenCalled();
		replacement.state = 'activated';
		registration.active = replacement;
		registration.installing = null;
		replacement.dispatchEvent(new Event('statechange'));
		await startup;
		expect(postMessage).toHaveBeenCalledWith(
			{ type: 'wordpress-bridge-ready', scope: 'test' },
			'https://playground.test'
		);
	});

	it('keeps an installed worker usable when the update check cannot reach the server', async () => {
		registration.update.mockRejectedValue(new TypeError('Offline'));
		await import('./wordpress-bridge');
		expect(postMessage).toHaveBeenCalledWith(
			{ type: 'wordpress-bridge-ready', scope: 'test' },
			'https://playground.test'
		);
	});

	it('keeps an installed worker usable when the versioned worker cannot be fetched', async () => {
		vi.mocked(navigator.serviceWorker.register).mockRejectedValue(
			new TypeError('Offline')
		);
		await import('./wordpress-bridge');
		expect(navigator.serviceWorker.getRegistration).toHaveBeenCalledWith(
			'/'
		);
		expect(postMessage).toHaveBeenCalledWith(
			{ type: 'wordpress-bridge-ready', scope: 'test' },
			'https://playground.test'
		);
	});

	it.each(['missing', 'inactive'])(
		'does not report ready after a registration failure with a %s worker',
		async (state) => {
			const error = new TypeError('No installed worker');
			vi.mocked(navigator.serviceWorker.register).mockRejectedValue(
				error
			);
			if (state === 'missing') {
				vi.mocked(
					navigator.serviceWorker.getRegistration
				).mockResolvedValue(undefined);
			} else {
				registration.active = null;
			}
			await expect(import('./wordpress-bridge')).rejects.toBe(error);
			expect(postMessage).not.toHaveBeenCalled();
		}
	);

	it('does not report ready after an update failure without an active worker', async () => {
		registration.active = null;
		const error = new TypeError('No installed worker');
		registration.update.mockRejectedValue(error);
		await expect(import('./wordpress-bridge')).rejects.toBe(error);
		expect(postMessage).not.toHaveBeenCalled();
	});

	it('returns each reply through the worker port that carried its request', async () => {
		await import('./wordpress-bridge');
		const onParentMessage = vi
			.mocked(window.addEventListener)
			.mock.calls.find(([type]) => type === 'message')![1] as (
			event: Partial<MessageEvent>
		) => void;
		const onWorkerMessage = vi
			.mocked(navigator.serviceWorker.addEventListener)
			.mock.calls.find(([type]) => type === 'message')![1] as (
			event: Partial<MessageEvent>
		) => void;
		const firstPort = registeredPort(registration.active!);
		// A restarted worker registers a new port and restarts its request IDs.
		const restarted = testWorker('activated');
		onWorkerMessage({
			data: { type: 'connect-scoped-request-port' },
			source: restarted as unknown as ServiceWorker,
		});
		const secondPort = registeredPort(restarted);
		const replies = [firstPort, secondPort].map(
			(port) => new Promise((resolve) => port.once('message', resolve))
		);
		for (const port of [firstPort, secondPort]) {
			port.postMessage({ method: 'request', args: [], requestId: 1 });
		}
		await vi.waitFor(() => expect(postMessage).toHaveBeenCalledTimes(3));
		const relayed = postMessage.mock.calls
			.slice(1)
			.map(([data]) => data.requestId);
		expect(new Set(relayed).size).toBe(2);
		for (const [index, requestId] of relayed.entries()) {
			onParentMessage({
				source: window.parent as Window,
				origin: 'https://playground.test',
				data: {
					type: 'wordpress-bridge-response',
					scope: 'test',
					requestId,
					response: { from: index },
				},
			});
		}
		expect(await Promise.all(replies)).toEqual([
			{ type: 'response', requestId: 1, response: { from: 0 } },
			{ type: 'response', requestId: 1, response: { from: 1 } },
		]);
		firstPort.close();
		secondPort.close();
	});
});

function registeredPort(worker: TestWorker): NodeMessagePort {
	const [message, [port]] = worker.postMessage.mock.calls.at(-1)!;
	expect(message).toEqual({
		type: 'register-scoped-request-port',
		scope: 'test',
	});
	return port;
}
