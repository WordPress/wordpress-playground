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
		exposeAPI({}, undefined, undefined, appOrigin);
		requestPort(origin, parent);
		await new Promise<void>((resolve) => setImmediate(resolve));
		expect(channels).toHaveLength(0);
		expect(parent.postMessage).not.toHaveBeenCalled();
	});

	it('does not grant an API port to another window with the allowed origin', async () => {
		exposeAPI({}, undefined, undefined, appOrigin);
		requestPort(appOrigin, {});
		await new Promise<void>((resolve) => setImmediate(resolve));
		expect(channels).toHaveLength(0);
		expect(parent.postMessage).not.toHaveBeenCalled();
	});

	it('grants the allowed parent a working private API port', async () => {
		const readSecret = vi.fn(() => 'private result');
		exposeAPI({ readSecret }, undefined, undefined, appOrigin);
		requestPort(appOrigin, parent);
		await vi.waitFor(() => expect(parent.postMessage).toHaveBeenCalled());
		expect(parent.postMessage.mock.calls[0][1]).toBe(appOrigin);
		const port = parent.postMessage.mock.calls[0][0].value!;
		const api = wrap<{ readSecret(): Promise<string> }>(port);
		expect(await api['readSecret']()).toBe('private result');
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
			appOrigin
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

	it.each([
		{ origin: ['https://one.test', 'https://two.test'] },
		{ origin: /wordpress/ },
		{ origin: 'null' },
		{ origin: 'https://playground.wordpress.net/path' },
	])('rejects ambiguous or opaque authorization %j', ({ origin }) => {
		expect(() =>
			exposeAPI({}, undefined, undefined, origin as string)
		).toThrow();
	});

	it('explicitly permits external callers for the public runtime', async () => {
		exposeAPI({}, undefined, undefined, '*');
		requestPort('https://external.example', parent);
		await vi.waitFor(() =>
			expect(parent.postMessage).toHaveBeenCalledOnce()
		);
		expect(parent.postMessage.mock.calls[0][1]).toBe('*');
	});

	it('keeps asynchronous replies bound to the authorized origin', async () => {
		let finish!: (value: string) => void;
		exposeAPI({
			readSecret: () =>
				new Promise<string>((resolve) => {
					finish = resolve;
				}),
		});
		events.dispatchEvent(
			Object.assign(new Event('message'), {
				origin: appOrigin,
				source: parent,
				data: {
					id: 'delayed',
					type: 'APPLY',
					path: ['readSecret'],
					argumentList: [],
				},
			})
		);
		await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
		finish('secret');
		await vi.waitFor(() =>
			expect(parent.postMessage).toHaveBeenCalledOnce()
		);
		expect(parent.postMessage.mock.calls[0][1]).toBe(appOrigin);
	});

	it('exposes class and piped methods, but never JavaScript inheritance machinery', async () => {
		class Methods {
			readSecret() {
				return 'secret';
			}
		}
		const downstream = new MessageChannel();
		exposeAPI(new Methods(), undefined, downstream.port1);
		const upstream = new MessageChannel();
		exposeAPI({}, wrap(downstream.port2), upstream.port1);
		const api = wrap<any>(upstream.port2);
		expect(await api['readSecret']()).toBe('secret');
		await expect(api['__lookupGetter__']('__proto__')).rejects.toThrow();
		await expect(api['readSecret'].call(null)).rejects.toThrow();
		await expect(
			api['readSecret'].__defineGetter__('polluted', () => true)
		).rejects.toThrow();
		const callable = await api['readSecret'];
		expect(await callable()).toBe('secret');
		await expect(callable.call(null)).rejects.toThrow();
		await expect(
			callable.__defineGetter__('polluted', () => true)
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
