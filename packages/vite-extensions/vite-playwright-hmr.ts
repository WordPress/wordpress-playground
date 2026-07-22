import type { Plugin } from 'vite';

const viteClientModuleSuffix = '/vite/dist/client/client.mjs';
const nativeWebSocketConstructor = 'new WebSocket(';
const playwrightHmrEnvironmentVariable = 'PLAYWRIGHT_MOCK_VITE_HMR_IN_FIREFOX';

// Playwright 1.61's Firefox WebSocket instrumentation asserts when Vite's HMR
// upgrade finishes without a normal HTTP response. During e2e runs, emulate only
// Vite's handshake; application WebSockets never pass through this transform.
const mockViteHmrWebSocket = `
class __PlaywrightViteHmrWebSocket extends EventTarget {
	CONNECTING = 0;
	OPEN = 1;
	CLOSING = 2;
	CLOSED = 3;
	bufferedAmount = 0;
	extensions = '';
	protocol = 'vite-hmr';
	readyState = this.CONNECTING;

	constructor(url, protocols) {
		super();
		// One transformed Vite client serves every project. Preserve native HMR in
		// Chromium and WebKit, where Playwright handles the upgrade normally.
		if (!navigator.userAgent.includes('Firefox/')) {
			return new WebSocket(url, protocols);
		}

		// Test runs use frozen source, so Firefox only needs a successful handshake
		// rather than source-update messages or reconnect attempts.
		this.url = String(url);
		queueMicrotask(() => {
			if (this.readyState !== this.CONNECTING) {
				return;
			}
			this.readyState = this.OPEN;
			this.dispatchEvent(new Event('open'));
			this.dispatchEvent(new MessageEvent('message', {
				data: JSON.stringify({ type: 'connected' }),
			}));
		});
	}

	send() {}

	close() {
		if (this.readyState === this.CLOSED) {
			return;
		}
		this.readyState = this.CLOSED;
		const event = new Event('close');
		Object.defineProperty(event, 'wasClean', { value: true });
		this.dispatchEvent(event);
	}
}
`;

export function vitePlaywrightHmr(): Plugin {
	const enabled = process.env[playwrightHmrEnvironmentVariable] === 'true';
	let hasObjectHmrConfiguration = false;
	return {
		name: 'vite-playwright-hmr',
		apply: 'serve',
		enforce: 'post',
		configResolved(config) {
			hasObjectHmrConfiguration =
				!!config.server.hmr && typeof config.server.hmr === 'object';
		},
		transform(code, id) {
			if (!enabled || !id.endsWith(viteClientModuleSuffix)) {
				return null;
			}
			// Nx resolves Vite once before merging executor-level server options,
			// then resolves it again to create the server. Validate lazily when the
			// actual server requests Vite's client module.
			if (!hasObjectHmrConfiguration) {
				throw new Error(
					`${playwrightHmrEnvironmentVariable}=true requires an object ` +
						'Vite server.hmr configuration.'
				);
			}
			// Fail closed if a Vite upgrade changes the constructor being replaced.
			const occurrences =
				code.split(nativeWebSocketConstructor).length - 1;
			if (occurrences !== 1) {
				throw new Error(
					`Expected one Vite HMR WebSocket constructor, found ${occurrences}.`
				);
			}
			return {
				code:
					mockViteHmrWebSocket +
					code.replace(
						nativeWebSocketConstructor,
						'new __PlaywrightViteHmrWebSocket('
					),
				map: null,
			};
		},
	};
}
