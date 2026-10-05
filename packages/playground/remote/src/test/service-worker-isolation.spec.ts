// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runInNewContext } from 'node:vm';
import { createElement, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { setURLScope } from '@php-wasm/scopes';
import { responseTo } from '@php-wasm/web-service-worker';
import type * as WebServiceWorker from '@php-wasm/web-service-worker';

vi.mock('@php-wasm/web-service-worker', async (importOriginal) => ({
	...(await importOriginal<typeof WebServiceWorker>()),
	convertFetchEventToPHPRequest: vi.fn(async (event: FetchEvent) => {
		const url = new URL(event.request.url);
		if (url.pathname.endsWith('.php')) {
			const headers = new Headers({
				'Content-Type': 'text/html; charset=UTF-8',
			});
			if (url.pathname.endsWith('/site-editor.php')) {
				const policy =
					url.searchParams.get('policy') ??
					'isolate-and-credentialless';
				if (policy === 'coep') {
					headers.set(
						'Cross-Origin-Embedder-Policy',
						url.searchParams.get('coep') ?? 'credentialless'
					);
					headers.set('Cross-Origin-Opener-Policy', 'same-origin');
				} else {
					headers.set('Document-Isolation-Policy', policy);
				}
			}
			return new Response(
				'<!doctype html><html lang="en"><head></head><body></body></html>',
				{
					headers,
				}
			);
		}
		return new Response(
			'window.render = (props) => window.wp.element.createElement("iframe", props);'
		);
	}),
}));
vi.mock('@php-wasm/universal', () => ({}));
vi.mock('@php-wasm/web', () => {
	const worker = {
		boot: async () => {},
		isConnected: async () => {},
		isReady: async () => {},
		getWordPressModuleDetails: async () => ({
			staticAssetsDirectory: 'wp-test',
		}),
		hasCachedStaticFilesRemovedFromMinifiedBuild: async () => false,
		absoluteUrl: 'https://playground.wordpress.net/',
	};
	return {
		spawnPHPWorkerThread: async () => worker,
		consumeAPI: () => worker,
		exposeAPI: (api: object) => [() => {}, () => {}, { ...worker, ...api }],
		setupPostMessageRelay: () => {},
	};
});
vi.mock('../lib/webmcp-frame-bridge', () => ({
	createWebMCPFrameBridge: () => ({}),
}));
vi.mock('../../service-worker.ts?worker&url', () => ({ default: '/sw.js' }));
vi.mock('../lib/capture-site-thumbnail.ts?worker&url', () => ({
	default: '/thumbnail.js',
}));
vi.mock('../lib/playground-worker-endpoint-blueprints.ts?worker&url', () => ({
	default: '/worker.js',
}));
vi.mock('@wp-playground/wordpress', () => ({}));
vi.mock('@php-wasm/logger', () => ({ reportServiceWorkerMetrics() {} }));
vi.mock('../lib/offline-mode-cache', () => ({
	isCurrentServiceWorkerActive: () => true,
}));
vi.mock('@wp-playground/remote-access', () => ({
	getRemoteAccessRelayMapping: () => undefined,
	getRemoteAccessRelayMappingFromUrl: () => undefined,
	handleRemoteAccessRelayMessage() {},
}));

const origin = 'https://playground.wordpress.net';
const scope = 'editor-isolation-test';
const editorUrl = setURLScope(
	new URL('/wp-admin/site-editor.php', origin),
	scope
);

describe('Editor iframe isolation', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		Reflect.deleteProperty(window, 'IS_WASM_WORDPRESS');
		document.body.replaceChildren();
	});

	it.each([
		{ srcDoc: '<!doctype html>' },
		{ src: `blob:${origin}/editor-document` },
	])('preserves isolation after a worker restart for %j', async (props) => {
		const worker = await createServiceWorker();
		await worker('/wp-admin/site-editor.php');
		const render = await getIframeRenderer(worker, true);
		const iframe = render(props);
		const redirect = await worker(iframe.src, 'manual');
		expect(redirect.status).toBe(302);
		const target = redirect.headers.get('location')!;
		expect(new URL(target).searchParams.get('cross-origin-isolated')).toBe(
			'1'
		);
		const beforeRestart = await worker(target);
		expect(beforeRestart.headers.get('Document-Isolation-Policy')).toBe(
			'isolate-and-credentialless'
		);

		// The editor and its script stay loaded while the service worker is retired.
		const restartedWorker = await createServiceWorker();
		const restartedRedirect = await restartedWorker(
			render(props).src,
			'manual'
		);
		expect(restartedRedirect.status).toBe(302);
		expect(restartedRedirect.headers.get('location')).toBe(target);
		const afterRestart = await restartedWorker(
			restartedRedirect.headers.get('location')!
		);
		expect(afterRestart.headers.get('Document-Isolation-Policy')).toBe(
			'isolate-and-credentialless'
		);
	});

	it.each([
		{ supported: true, coep: 'credentialless' },
		{ supported: true, coep: 'require-corp' },
		{ supported: false, coep: 'credentialless' },
		{ supported: false, coep: 'require-corp' },
	])(
		'recovers browser support after a worker restart: %j',
		async ({ supported, coep }) => {
			const worker = await createServiceWorker();
			const page = await bootRemotePage(supported);
			const path = `/wp-admin/site-editor.php?policy=coep&coep=${coep}`;
			const expectedPolicy = supported ? `isolate-and-${coep}` : null;
			const beforeRestart = await worker(path);
			expect(beforeRestart.headers.get('Document-Isolation-Policy')).toBe(
				expectedPolicy
			);
			expect(page.postMessage).not.toHaveBeenCalled();

			// Keep the live page and its detection result, but discard the worker's globals.
			const restartedWorker = await createServiceWorker([page]);
			const afterRestart = await restartedWorker(path);
			expect(afterRestart.headers.get('Document-Isolation-Policy')).toBe(
				expectedPolicy
			);
			expect(
				afterRestart.headers.get('Cross-Origin-Embedder-Policy')
			).toBe(supported ? null : coep);
			expect(afterRestart.headers.get('Cross-Origin-Opener-Policy')).toBe(
				supported ? null : 'same-origin'
			);
			expect(page.postMessage).toHaveBeenCalledWith({
				method: 'getWordPressModuleDetails',
				scope,
				requestId: expect.any(Number),
			});

			// Both true and false results are cached for subsequent responses.
			const repeated = await restartedWorker(path);
			expect(repeated.headers.get('Document-Isolation-Policy')).toBe(
				expectedPolicy
			);
			expect(page.postMessage).toHaveBeenCalledTimes(1);
		}
	);

	it('does not query browser support for responses that need no conversion', async () => {
		const page = { postMessage: vi.fn() };
		const worker = await createServiceWorker([page]);
		await worker('/wp-admin/site-editor.php');
		await worker('/wp-admin/non-isolated-editor.php');
		await worker('/wp-admin/site-editor.php?policy=coep&coep=unsafe-none');
		expect(page.postMessage).not.toHaveBeenCalled();
	});

	it('keeps the original headers when an older page omits the capability', async () => {
		const page = {
			postMessage: vi.fn((message: unknown) => {
				const { requestId } = message as { requestId: number };
				setTimeout(
					() =>
						self.dispatchEvent(
							new MessageEvent('message', {
								data: responseTo(requestId, {
									staticAssetsDirectory: 'wp-test',
								}),
							})
						),
					0
				);
			}),
		};
		const worker = await createServiceWorker([page]);
		for (let i = 0; i < 2; i++) {
			const response = await worker(
				'/wp-admin/site-editor.php?policy=coep'
			);
			expect(
				response.headers.get('Document-Isolation-Policy')
			).toBeNull();
			expect(response.headers.get('Cross-Origin-Embedder-Policy')).toBe(
				'credentialless'
			);
			expect(response.headers.get('Cross-Origin-Opener-Policy')).toBe(
				'same-origin'
			);
		}
		expect(page.postMessage).toHaveBeenCalledTimes(1);
	});

	it('keeps the original headers on a timeout and retries the next request', async () => {
		await createServiceWorker();
		const page = await bootRemotePage(true);
		page.postMessage.mockImplementationOnce(() => {});
		const worker = await createServiceWorker([page]);
		vi.useFakeTimers();
		const pending = worker('/wp-admin/site-editor.php?policy=coep');
		await vi.runAllTimersAsync();
		const response = await pending;
		expect(response.headers.get('Document-Isolation-Policy')).toBeNull();
		expect(response.headers.get('Cross-Origin-Embedder-Policy')).toBe(
			'credentialless'
		);
		expect(response.headers.get('Cross-Origin-Opener-Policy')).toBe(
			'same-origin'
		);
		vi.useRealTimers();
		const retry = await worker('/wp-admin/site-editor.php?policy=coep');
		expect(retry.headers.get('Document-Isolation-Policy')).toBe(
			'isolate-and-credentialless'
		);
		expect(page.postMessage).toHaveBeenCalledTimes(2);
	});

	it('does not isolate a non-isolated document in a previously isolated site', async () => {
		const worker = await createServiceWorker();
		await worker('/wp-admin/site-editor.php');
		const render = await getIframeRenderer(worker, false);
		const iframe = render({ src: `blob:${origin}/editor-document` });
		const response = await worker(iframe.src);
		expect(response.headers.has('Document-Isolation-Policy')).toBe(false);
	});

	it('keeps the blob URL in the fragment and removes srcDoc', async () => {
		const worker = await createServiceWorker();
		const render = await getIframeRenderer(worker, true);
		const blobUrl = `blob:${origin}/editor-document`;
		const iframe = render({ src: blobUrl });
		expect(
			decodeURIComponent(new URL(iframe.src, origin).hash.slice(1))
		).toBe(blobUrl);
		expect(render({ srcDoc: '<!doctype html>' }).srcDoc).toBeUndefined();
	});

	it('updates the preview URL when srcDoc changes without changing src', async () => {
		const worker = await createServiceWorker();
		const render = await getIframeRenderer(worker, true, useMemo);
		let iframe: IframeProps;
		function Preview(props: IframeProps) {
			iframe = render(props);
			return null;
		}
		const root = createRoot(document.createElement('div'));
		const src = `blob:${origin}/editor-document`;
		try {
			flushSync(() => root.render(createElement(Preview, { src })));
			const blobPreview = iframe!.src!;
			expect(decodeURIComponent(new URL(blobPreview).hash.slice(1))).toBe(
				src
			);

			flushSync(() =>
				root.render(
					createElement(Preview, { src, srcDoc: '<!doctype html>' })
				)
			);
			expect(new URL(iframe!.src!).hash).toBe('');
			expect(iframe!.srcDoc).toBeUndefined();

			flushSync(() => root.render(createElement(Preview, { src })));
			expect(iframe!.src).toBe(blobPreview);
		} finally {
			root.unmount();
		}
	});

	it.each([
		'https://example.com/preview',
		'/wp-includes/empty.html',
		`${origin}/scope:${scope}/wp-includes/empty.html`,
		'http://[',
		'https://example.com:invalid/preview',
		'//[bad-host]/preview',
	])('leaves the iframe URL unchanged: %s', async (src) => {
		const worker = await createServiceWorker();
		const render = await getIframeRenderer(worker, true);
		expect(render({ src }).src).toBe(src);
	});

	it('does not isolate empty.html without an explicit request', async () => {
		const worker = await createServiceWorker();
		const response = await worker('/wp-includes/empty.html');
		expect(response.headers.has('Document-Isolation-Policy')).toBe(false);
	});
});

async function createServiceWorker(
	clients: { postMessage(message: unknown): void }[] = []
) {
	vi.resetModules();
	const events = new EventTarget();
	vi.stubGlobal('self', {
		location: new URL('/sw.js', origin),
		addEventListener: events.addEventListener.bind(events),
		removeEventListener: events.removeEventListener.bind(events),
		dispatchEvent: events.dispatchEvent.bind(events),
		clients: { matchAll: async () => clients },
	});
	await import('../../service-worker');
	return async function request(
		path: string,
		redirect: 'follow' | 'manual' = 'follow'
	): Promise<Response> {
		let response: Promise<Response> | undefined;
		const url = new URL(path, origin);
		// URL fragments are not sent with HTTP requests.
		url.hash = '';
		const event = Object.assign(new Event('fetch'), {
			request: new Request(url, { referrer: editorUrl.href }),
			respondWith(value: Response | Promise<Response>) {
				response = Promise.resolve(value);
			},
		});
		events.dispatchEvent(event);
		if (!response) {
			throw new Error(`Service worker did not handle ${path}`);
		}
		const result = await response;
		if (redirect === 'follow' && result.status === 302) {
			return request(result.headers.get('location')!, 'manual');
		}
		return result;
	};
}

async function bootRemotePage(supported: boolean) {
	const events = new EventTarget();
	const controller = {
		postMessage(data: unknown) {
			self.dispatchEvent(new MessageEvent('message', { data }));
		},
	};
	vi.stubGlobal('navigator', {
		serviceWorker: {
			register: async () => ({ update: async () => {} }),
			controller,
			addEventListener: events.addEventListener.bind(events),
			startMessages() {},
		},
	});
	document.body.innerHTML = '<iframe id="wp"></iframe>';
	// The boot module runs at an HTTP URL in production, but Vitest loads it from disk.
	const NativeURL = URL;
	vi.stubGlobal(
		'URL',
		class extends NativeURL {
			override get origin() {
				return this.protocol === 'file:' ? origin : super.origin;
			}
		}
	);
	const { bootPlaygroundRemote } =
		await import('../lib/boot-playground-remote');
	vi.stubGlobal('URL', NativeURL);
	const playground = await bootPlaygroundRemote();
	const detectionFrame = document.querySelector<HTMLIFrameElement>(
		'iframe[src="/feature-detect/document-isolation-policy.html"]'
	)!;
	window.dispatchEvent(
		new MessageEvent('message', {
			data: { supported },
			source: detectionFrame.contentWindow,
		})
	);
	await playground.boot({ scope, withNetworking: false });
	return {
		postMessage: vi.fn((data: unknown) => {
			// postMessage delivers in a later task, after awaitReply installs its listener.
			setTimeout(
				() =>
					events.dispatchEvent(
						Object.assign(new Event('message'), {
							data,
							source: controller,
						})
					),
				0
			);
		}),
	};
}

type IframeProps = { src?: string; srcDoc?: string };

async function getIframeRenderer(
	request: (path: string) => Promise<Response>,
	crossOriginIsolated: boolean,
	memoize: typeof useMemo = (callback) => callback()
): Promise<(props: IframeProps) => IframeProps & { src: string }> {
	const script = await request('/wp-includes/js/dist/block-editor.js');
	// Execute the actual injected wrapper with only its React calls stubbed.
	const window = {
		crossOriginIsolated,
		location: editorUrl,
		wp: {
			element: {
				forwardRef: (render: unknown) => render,
				useMemo: memoize,
				createElement: (
					component: string | ((props: IframeProps) => IframeProps),
					props: IframeProps
				) =>
					typeof component === 'function' ? component(props) : props,
			},
		},
	};
	return runInNewContext(
		'globalThis.window = globalThis;' +
			(await script.text()) +
			'; window.render;',
		{ ...window, URL }
	);
}
