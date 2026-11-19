import { vi } from 'vitest';

const config = vi.hoisted(() => ({
	playgroundOrigin: 'https://my.wordpress.net',
	wordPressSiteUrl: 'https://wpsandbox.wordpress.net',
}));

vi.mock('./config', () => config);

describe('WordPress popup loopback permission', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it.each([
		'https://my.wordpress.net',
		'https://playground.wordpress.net',
		'https://example.com',
	])(
		'does not implicitly delegate based on the hosting domain %s',
		async (origin) => {
			config.playgroundOrigin = origin;
			const frame = { allow: '', src: '' };
			vi.stubGlobal('location', {
				href: origin + '/wordpress-popup.html',
				hash: '#https://wpsandbox.wordpress.net/scope:popup/wp-admin/',
			});
			vi.stubGlobal('document', { querySelector: () => frame });

			const { bootWordPressPopup } = await import('./wordpress-popup');
			bootWordPressPopup();

			expect(frame.allow).toBe('');
			expect(frame.src).toBe(
				'https://wpsandbox.wordpress.net/scope:popup/wp-admin/'
			);
		}
	);
	it('lets a Personal WP entry point opt in on a custom host', async () => {
		config.playgroundOrigin = 'https://personal.example';
		const frame = { allow: '', src: '' };
		vi.stubGlobal('location', {
			origin: config.playgroundOrigin,
			href: config.playgroundOrigin + '/wordpress-popup.html',
			hash: '#https://wpsandbox.wordpress.net/scope:popup/wp-admin/',
		});
		vi.stubGlobal('document', { querySelector: () => frame });
		const { bootWordPressPopup } = await import('./wordpress-popup');
		bootWordPressPopup({ allowLoopbackNetwork: true });
		expect(frame.allow).toBe(
			'loopback-network https://wpsandbox.wordpress.net'
		);
		expect(frame.src).toBe(
			'https://wpsandbox.wordpress.net/scope:popup/wp-admin/'
		);
	});

	it.each(['#https://unrelated.example/scope:popup/', '#/api.html'])(
		'rejects an invalid destination %s before delegating',
		async (hash) => {
			const frame = { allow: '', src: '' };
			vi.stubGlobal('location', {
				href: 'https://personal.example/wordpress-popup.html',
				hash,
			});
			vi.stubGlobal('document', { querySelector: () => frame });
			const { bootWordPressPopup } = await import('./wordpress-popup');
			expect(() =>
				bootWordPressPopup({ allowLoopbackNetwork: true })
			).toThrow();
			expect(frame.allow).toBe('');
			expect(frame.src).toBe('');
		}
	);
	it.each([false, true])(
		'preserves scoped-route destinations with delegation %s',
		async (allowed) => {
			const frame = { allow: '', src: '' };
			const location = new URL(
				'https://personal.example/scope:popup/wp-admin/?preview_nonce=a%2Bb#preview'
			);
			vi.stubGlobal('location', location);
			vi.stubGlobal('document', { querySelector: () => frame });
			const { bootWordPressPopup } = await import('./wordpress-popup');
			bootWordPressPopup({ allowLoopbackNetwork: allowed });
			expect(frame.src).toBe(
				'https://wpsandbox.wordpress.net/scope:popup/wp-admin/?preview_nonce=a%2Bb#preview'
			);
			expect(frame.allow).toBe(
				allowed
					? 'loopback-network https://wpsandbox.wordpress.net'
					: ''
			);
		}
	);
});

describe('WordPress popup cross-partition opener bridge', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it('attaches a hidden bridge and relays requests when opener is in another partition', async () => {
		config.playgroundOrigin = 'https://playground.wordpress.net';
		config.wordPressSiteUrl = 'https://wpsandbox.wordpress.net';

		const windowListeners = new Set<(event: MessageEvent) => void>();
		const openerPostMessage = vi.fn();
		const openerRemote = {
			closed: false,
			postMessage: openerPostMessage,
		} as unknown as Window;
		const bridgePostMessage = vi.fn();
		const bridgeIframe = {
			hidden: false,
			title: '',
			src: '',
			contentWindow: { postMessage: bridgePostMessage },
			remove: vi.fn(),
		};
		const appended: unknown[] = [];
		const frame = { allow: '', src: '' };

		class IsolatedBroadcastChannel {
			addEventListener() {}
			postMessage() {}
			close() {}
		}

		vi.stubGlobal('BroadcastChannel', IsolatedBroadcastChannel);
		vi.stubGlobal(
			'location',
			new URL(
				'https://playground.wordpress.net/scope:embedded/sample-page/'
			)
		);
		vi.stubGlobal('document', {
			querySelector: () => frame,
			createElement: () => bridgeIframe,
			body: { append: (el: unknown) => appended.push(el) },
		});
		vi.stubGlobal('window', {
			opener: { closed: false, parent: openerRemote },
			addEventListener: (
				type: string,
				listener: (event: MessageEvent) => void
			) => {
				if (type === 'message') {
					windowListeners.add(listener);
				}
			},
			removeEventListener: (
				type: string,
				listener: (event: MessageEvent) => void
			) => {
				if (type === 'message') {
					windowListeners.delete(listener);
				}
			},
		});

		const dispatchMessage = (event: Partial<MessageEvent>) => {
			for (const listener of [...windowListeners]) {
				listener(event as MessageEvent);
			}
		};

		const { bootWordPressPopup } = await import('./wordpress-popup');
		bootWordPressPopup();

		expect(openerPostMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'wordpress-popup-partition-probe',
				scope: 'embedded',
			}),
			'https://playground.wordpress.net'
		);
		const probeId = openerPostMessage.mock.calls[0][0].probeId;

		dispatchMessage({
			origin: 'https://playground.wordpress.net',
			source: openerRemote as unknown as MessageEventSource,
			data: {
				type: 'wordpress-popup-partition-probe-ack',
				scope: 'embedded',
				probeId,
				bridgeUrl:
					'https://wpsandbox.wordpress.net/wordpress-bridge-v1.html?scope=embedded',
			},
		});

		await vi.waitFor(() => {
			expect(appended).toHaveLength(1);
		});
		expect(bridgeIframe.src).toBe(
			'https://wpsandbox.wordpress.net/wordpress-bridge-v1.html?scope=embedded'
		);
		expect(frame.src).toBe('');

		dispatchMessage({
			origin: 'https://wpsandbox.wordpress.net',
			source: bridgeIframe.contentWindow as unknown as MessageEventSource,
			data: {
				type: 'wordpress-bridge-ready',
				scope: 'embedded',
			},
		});

		await vi.waitFor(() => {
			expect(frame.src).toBe(
				'https://wpsandbox.wordpress.net/scope:embedded/sample-page/'
			);
		});

		dispatchMessage({
			origin: 'https://wpsandbox.wordpress.net',
			source: bridgeIframe.contentWindow as unknown as MessageEventSource,
			data: {
				type: 'wordpress-bridge-request',
				scope: 'embedded',
				requestId: 42,
				method: 'request',
				args: [
					{
						url: 'https://wpsandbox.wordpress.net/scope:embedded/sample-page/',
					},
				],
			},
		});

		expect(openerPostMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'wordpress-popup-bridge-request',
				scope: 'embedded',
				requestId: 42,
				method: 'request',
			}),
			'https://playground.wordpress.net'
		);

		dispatchMessage({
			origin: 'https://playground.wordpress.net',
			source: openerRemote as unknown as MessageEventSource,
			data: {
				type: 'wordpress-popup-bridge-response',
				scope: 'embedded',
				requestId: 42,
				response: { httpStatusCode: 200, headers: {} },
			},
		});

		expect(bridgePostMessage).toHaveBeenCalledWith(
			{
				type: 'wordpress-bridge-response',
				scope: 'embedded',
				requestId: 42,
				response: { httpStatusCode: 200, headers: {} },
			},
			'https://wpsandbox.wordpress.net',
			[]
		);

		(openerRemote as { closed: boolean }).closed = true;
		dispatchMessage({
			origin: 'https://wpsandbox.wordpress.net',
			source: bridgeIframe.contentWindow as unknown as MessageEventSource,
			data: {
				type: 'wordpress-bridge-request',
				scope: 'embedded',
				requestId: 43,
				method: 'request',
				args: [
					{
						url: 'https://wpsandbox.wordpress.net/scope:embedded/sample-page/',
					},
				],
			},
		});

		expect(bridgePostMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'wordpress-bridge-response',
				scope: 'embedded',
				requestId: 43,
				response: expect.objectContaining({ httpStatusCode: 503 }),
			}),
			'https://wpsandbox.wordpress.net'
		);
	});

	it('skips creating a duplicate bridge when opener shares the same partition', async () => {
		config.playgroundOrigin = 'https://playground.wordpress.net';
		config.wordPressSiteUrl = 'https://wpsandbox.wordpress.net';

		const windowListeners = new Set<(event: MessageEvent) => void>();
		const bcListeners = new Set<(event: MessageEvent) => void>();
		const openerPostMessage = vi.fn();
		const openerRemote = {
			closed: false,
			postMessage: openerPostMessage,
		} as unknown as Window;
		const appended: unknown[] = [];
		const frame = { allow: '', src: '' };

		class SharedBroadcastChannel {
			addEventListener(
				type: string,
				listener: (event: MessageEvent) => void
			) {
				if (type === 'message') bcListeners.add(listener);
			}
			postMessage() {}
			close() {}
		}

		vi.stubGlobal('BroadcastChannel', SharedBroadcastChannel);
		vi.stubGlobal(
			'location',
			new URL('https://playground.wordpress.net/scope:same/sample-page/')
		);
		vi.stubGlobal('document', {
			querySelector: () => frame,
			createElement: vi.fn(),
			body: { append: (el: unknown) => appended.push(el) },
		});
		vi.stubGlobal('window', {
			opener: { closed: false, parent: openerRemote },
			addEventListener: (
				type: string,
				listener: (event: MessageEvent) => void
			) => {
				if (type === 'message') windowListeners.add(listener);
			},
			removeEventListener: (
				type: string,
				listener: (event: MessageEvent) => void
			) => {
				if (type === 'message') windowListeners.delete(listener);
			},
		});

		const { bootWordPressPopup } = await import('./wordpress-popup');
		bootWordPressPopup();

		const probeId = openerPostMessage.mock.calls[0][0].probeId;
		for (const listener of [...bcListeners]) {
			listener({
				data: {
					type: 'wordpress-popup-partition-probe-echo',
					scope: 'same',
					probeId,
				},
			} as MessageEvent);
		}
		for (const listener of [...windowListeners]) {
			listener({
				origin: 'https://playground.wordpress.net',
				source: openerRemote as unknown as MessageEventSource,
				data: {
					type: 'wordpress-popup-partition-probe-ack',
					scope: 'same',
					probeId,
					bridgeUrl:
						'https://wpsandbox.wordpress.net/wordpress-bridge-v1.html?scope=same',
				},
			} as MessageEvent);
		}

		await vi.waitFor(() => {
			expect(frame.src).toBe(
				'https://wpsandbox.wordpress.net/scope:same/sample-page/'
			);
		});
		expect(appended).toHaveLength(0);
	});
});
