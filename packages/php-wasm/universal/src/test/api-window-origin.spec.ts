import { exposeAPI } from '../lib/api';
import { wrap } from '../lib/comlink-sync';

describe('window API authorization', () => {
	const appOrigin = 'https://playground.wordpress.net';
	const NativeMessageChannel = globalThis.MessageChannel;
	let events: EventTarget;
	let channels: MessageChannel[];
	let parent: {
		postMessage: ReturnType<
			typeof vi.fn<
				(
					message: { value?: MessagePort },
					origin: string,
					transfer?: Transferable[]
				) => void
			>
		>;
	};

	beforeEach(() => {
		events = new EventTarget();
		channels = [];
		parent = { postMessage: vi.fn() };
		vi.stubGlobal('window', { location: { origin: appOrigin } });
		vi.stubGlobal('self', { parent });
		vi.stubGlobal('addEventListener', events.addEventListener.bind(events));
		vi.stubGlobal(
			'removeEventListener',
			events.removeEventListener.bind(events)
		);
		vi.stubGlobal(
			'MessageChannel',
			class extends NativeMessageChannel {
				constructor() {
					super();
					channels.push(this);
				}
			}
		);
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		for (const channel of channels) {
			channel.port1.close();
			channel.port2.close();
		}
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it.each([
		'https://wpsandbox.wordpress.net',
		'https://other.example',
		'null',
		'',
	])('does not grant an API port to parent origin %j', async (origin) => {
		exposeAPI({}, undefined, undefined, [appOrigin]);
		requestPort(origin, parent);
		await new Promise<void>((resolve) => setImmediate(resolve));
		expect(channels).toHaveLength(0);
		expect(parent.postMessage).not.toHaveBeenCalled();
	});

	it('does not grant an API port to another window with the allowed origin', async () => {
		exposeAPI({}, undefined, undefined, [appOrigin]);
		requestPort(appOrigin, {});
		await new Promise<void>((resolve) => setImmediate(resolve));
		expect(channels).toHaveLength(0);
		expect(parent.postMessage).not.toHaveBeenCalled();
	});

	it('grants the allowed parent a working private API port', async () => {
		const readSecret = vi.fn(() => 'private result');
		exposeAPI({ readSecret }, undefined, undefined, [appOrigin]);
		requestPort(appOrigin, parent);
		await vi.waitFor(() => expect(parent.postMessage).toHaveBeenCalled());
		expect(parent.postMessage.mock.calls[0][1]).toBe(appOrigin);
		const port = parent.postMessage.mock.calls[0][0].value!;
		const api = wrap<{ readSecret(): Promise<string> }>(port);
		expect(await api.readSecret()).toBe('private result');
		expect(readSecret).toHaveBeenCalledOnce();
	});

	it('defaults window APIs to the document origin', async () => {
		exposeAPI({ readSecret: () => 'private result' });
		requestPort('https://wpsandbox.wordpress.net', parent);
		await new Promise<void>((resolve) => setImmediate(resolve));
		expect(channels).toHaveLength(0);
		requestPort(appOrigin, parent);
		await vi.waitFor(() =>
			expect(parent.postMessage).toHaveBeenCalledOnce()
		);
		const port = parent.postMessage.mock.calls[0][0].value!;
		expect(
			await wrap<{ readSecret(): Promise<string> }>(port).readSecret()
		).toBe('private result');
	});

	it('does not expose JavaScript constructors through an API capability', async () => {
		exposeAPI(
			{ readSecret: () => 'private result' },
			undefined,
			undefined,
			[appOrigin]
		);
		requestPort(appOrigin, parent);
		await vi.waitFor(() => expect(parent.postMessage).toHaveBeenCalled());
		const port = parent.postMessage.mock.calls[0][0].value!;
		const api = wrap<any>(port);
		await expect(
			(async () => {
				const evaluate =
					await api.constructor.constructor('return "escaped"');
				return await evaluate();
			})()
		).rejects.toThrow();
	});

	function requestPort(origin: string, source: object) {
		events.dispatchEvent(
			Object.assign(new Event('message'), {
				origin,
				source,
				data: { id: 'private-port', type: 'ENDPOINT' },
			})
		);
	}
});
