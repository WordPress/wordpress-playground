// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runInNewContext } from 'node:vm';
import { createElement, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { setURLScope } from '@php-wasm/scopes';

vi.mock('@php-wasm/web-service-worker', () => ({
	convertFetchEventToPHPRequest: vi.fn(async (event: FetchEvent) => {
		const url = new URL(event.request.url);
		if (url.pathname.endsWith('.php')) {
			const headers = new Headers({
				'Content-Type': 'text/html; charset=UTF-8',
			});
			if (url.pathname.endsWith('/site-editor.php')) {
				headers.set(
					'Document-Isolation-Policy',
					'isolate-and-credentialless'
				);
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
		vi.unstubAllGlobals();
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

async function createServiceWorker() {
	vi.resetModules();
	const events = new EventTarget();
	vi.stubGlobal('self', {
		location: new URL('/sw.js', origin),
		addEventListener: events.addEventListener.bind(events),
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
