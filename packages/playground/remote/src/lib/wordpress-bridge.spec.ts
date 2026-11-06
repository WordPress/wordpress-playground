vi.mock('./config', () => ({
	playgroundOrigin: 'https://playground.test',
	wordPressSiteUrl: 'https://wp.playground.test',
	assetBaseUrl: new URL('https://playground.test/releases/release.A/'),
}));
vi.mock('virtual:remote-config', () => ({ buildVersion: 'new-release' }));

type TestWorker = EventTarget & { state: string };

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
		vi.stubGlobal(
			'fetch',
			vi.fn(() => {
				throw new TypeError('Offline');
			})
		);
		registration = {
			active: Object.assign(new EventTarget(), {
				state: 'activated',
				postMessage: workerStatus,
			}),
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
	});

	afterEach(() => vi.unstubAllGlobals());

	it('selects the immutable worker from loaded code without fetching metadata', async () => {
		await import('./wordpress-bridge');
		expect(navigator.serviceWorker.register).toHaveBeenCalledWith(
			new URL('https://wp.playground.test/sandbox-sw-release.A.js'),
			{ type: 'module', updateViaCache: 'none' }
		);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('waits for the update check and replacement activation with an existing registration', async () => {
		// Model register() returning release A's already-active registration.
		// B is not exposed as installing until its network update check finishes.
		const replacement = Object.assign(new EventTarget(), {
			state: 'installing',
			postMessage: workerStatus,
		});
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

	it.each([
		{ role: 'app' },
		{ release: 'release.B' },
		{ appOrigin: 'https://attacker.test' },
		{ wordPressOrigin: 'https://attacker.test' },
	])('rejects mismatched installed code %j', async (mismatch) => {
		Object.assign(registration.active!, {
			postMessage: (_message: unknown, ports: MessagePort[]) =>
				ports[0].postMessage({
					protocol: 1,
					role: 'sandbox',
					release: 'release.A',
					appOrigin: 'https://playground.test',
					wordPressOrigin: 'https://wp.playground.test',
					...mismatch,
				}),
		});
		await expect(import('./wordpress-bridge')).rejects.toThrow(
			'does not match'
		);
		expect(postMessage).not.toHaveBeenCalled();
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
});

function workerStatus(_message: unknown, ports: MessagePort[]) {
	ports[0].postMessage({
		protocol: 1,
		role: 'sandbox',
		release: 'release.A',
		appOrigin: 'https://playground.test',
		wordPressOrigin: 'https://wp.playground.test',
	});
}
