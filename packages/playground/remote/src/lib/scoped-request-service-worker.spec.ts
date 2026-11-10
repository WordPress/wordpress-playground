import { MessageChannel } from 'node:worker_threads';
import type { MessagePort as NodeMessagePort } from 'node:worker_threads';
import { responseTo } from '@php-wasm/web-service-worker';

vi.mock('./config', () => ({
	playgroundOrigin: 'https://playground.test',
	wordPressSiteUrl: 'https://wp.playground.test',
}));

const helperUrl = (scope: string) =>
	`https://wp.playground.test/wordpress-bridge.html?scope=${scope}`;

type TestClient = {
	id: string;
	url: string;
	postMessage: ReturnType<typeof vi.fn>;
};

describe('scoped service-worker request routing', () => {
	let clients: TestClient[];
	let workerListeners: Array<(event: { data: unknown }) => void>;
	const channels: MessageChannel[] = [];

	beforeEach(() => {
		vi.resetModules();
		clients = [];
		workerListeners = [];
		vi.stubGlobal('self', {
			location: { origin: 'https://wp.playground.test' },
			clients: {
				get: async (id: string) =>
					clients.find((client) => client.id === id),
				matchAll: async () => clients,
			},
			addEventListener: (
				type: string,
				listener: (event: { data: unknown }) => void
			) => {
				if (type === 'message') workerListeners.push(listener);
			},
			removeEventListener: () => {},
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
		for (const channel of channels.splice(0)) {
			channel.port1.close();
			channel.port2.close();
		}
	});

	function addClient(id: string, url: string) {
		const client = { id, url, postMessage: vi.fn() };
		clients.push(client);
		return client;
	}

	async function register(client: TestClient, scope: string) {
		const { registerScopedRequestPort } =
			await import('./scoped-request-service-worker');
		const channel = new MessageChannel();
		channels.push(channel);
		registerScopedRequestPort({
			data: { type: 'register-scoped-request-port', scope },
			ports: [channel.port1],
			source: client,
		} as unknown as ExtendableMessageEvent);
		return channel.port2;
	}

	function answer(port: NodeMessagePort, response: unknown) {
		const received = vi.fn();
		port.on('message', (data) => {
			received(data);
			port.postMessage(responseTo(data.requestId, response));
		});
		return received;
	}

	it('sends a request only to the client that serves its scope', async () => {
		const owner = addClient('owner', helperUrl('site-a'));
		const other = addClient('other', helperUrl('site-b'));
		const page = addClient(
			'page',
			'https://wp.playground.test/scope:site-b/'
		);
		const ownerRequests = answer(await register(owner, 'site-a'), 'served');
		const otherRequests = answer(await register(other, 'site-b'), 'wrong');

		const { sendScopedRequest } =
			await import('./scoped-request-service-worker');
		const message = {
			method: 'request',
			args: [{ url: 'https://wp.playground.test/scope:site-a/secret' }],
		};
		expect(await sendScopedRequest(message, 'site-a')).toBe('served');
		expect(ownerRequests).toHaveBeenCalledWith(
			expect.objectContaining(message)
		);
		expect(otherRequests).not.toHaveBeenCalled();
		for (const client of [owner, other, page]) {
			expect(client.postMessage).not.toHaveBeenCalled();
		}
	});

	it('ignores replies forged by other clients', async () => {
		const owner = addClient('owner', helperUrl('site-a'));
		const ownerPort = await register(owner, 'site-a');
		let reply!: () => void;
		const received = new Promise<number>((resolve) => {
			ownerPort.on('message', (data) => {
				reply = () =>
					ownerPort.postMessage(responseTo(data.requestId, 'served'));
				resolve(data.requestId);
			});
		});
		const attackerPort = await register(
			addClient('attacker', helperUrl('site-b')),
			'site-b'
		);

		const { sendScopedRequest } =
			await import('./scoped-request-service-worker');
		const result = sendScopedRequest(
			{ method: 'request', args: [] },
			'site-a'
		);
		const requestId = await received;
		for (const listener of workerListeners) {
			listener({ data: responseTo(requestId, 'forged') });
		}
		attackerPort.postMessage(responseTo(requestId, 'forged'));
		await new Promise((resolve) => setTimeout(resolve, 20));
		reply();
		expect(await result).toBe('served');
	});

	it.each([
		['a WordPress page', 'https://wp.playground.test/scope:site-a/'],
		['another scope helper', helperUrl('site-b')],
		[
			'a helper on another origin',
			'https://playground.test/wordpress-bridge.html?scope=site-a',
		],
	])('does not let %s register a scope', async (_, url) => {
		vi.useFakeTimers();
		const owner = addClient('owner', helperUrl('site-a'));
		const attacker = addClient('attacker', url);
		const attackerRequests = answer(
			await register(attacker, 'site-a'),
			'forged'
		);

		const { sendScopedRequest } =
			await import('./scoped-request-service-worker');
		const result = sendScopedRequest(
			{ method: 'request', args: [] },
			'site-a'
		);
		await vi.waitFor(() =>
			expect(owner.postMessage).toHaveBeenCalledWith({
				type: 'connect-scoped-request-port',
			})
		);
		vi.useRealTimers();
		answer(await register(owner, 'site-a'), 'served');
		expect(await result).toBe('served');
		expect(attackerRequests).not.toHaveBeenCalled();
		// Discovery names no scope and reaches only that scope's helper.
		expect(attacker.postMessage).not.toHaveBeenCalled();
	});

	it('reconnects to a live helper after its connection is lost', async () => {
		const closed = addClient('closed', helperUrl('site-a'));
		answer(await register(closed, 'site-a'), 'closed tab');
		clients.splice(clients.indexOf(closed), 1);
		const live = addClient('live', helperUrl('site-a'));
		live.postMessage.mockImplementation(async () => {
			answer(await register(live, 'site-a'), 'served');
		});

		const { sendScopedRequest } =
			await import('./scoped-request-service-worker');
		expect(
			await sendScopedRequest({ method: 'request', args: [] }, 'site-a')
		).toBe('served');
	});

	it('fails when no client serves the scope', async () => {
		vi.useFakeTimers();
		addClient('page', 'https://wp.playground.test/scope:site-a/');
		const { sendScopedRequest } =
			await import('./scoped-request-service-worker');
		const result = sendScopedRequest(
			{ method: 'request', args: [] },
			'site-a'
		);
		const failure = expect(result).rejects.toThrow();
		await vi.advanceTimersByTimeAsync(10000);
		await failure;
		expect(clients[0].postMessage).not.toHaveBeenCalled();
	});
});
