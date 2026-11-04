import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('./config', () => ({
	playgroundOrigin: 'https://app.test',
	wordPressSiteUrl: 'https://wordpress.test',
}));
vi.mock('./offline-mode-cache', () => ({
	cacheFirstFetch: vi.fn(
		async (request: Request) => new Response(request.url)
	),
	networkFirstFetch: vi.fn(async () => new Response('bootstrap')),
	fetchBlueprintsIndex: vi.fn(),
	cacheOfflineModeAssetsForCurrentRelease: vi.fn(),
	shouldCacheUrl: () => true,
}));

let listeners: Record<string, (event: any) => void>;
const stored = new Map<string, Response>();

beforeEach(() => {
	vi.resetModules();
	stored.clear();
	listeners = {};
	vi.stubGlobal('self', {
		location: new URL(
			'https://app.test/app-sw-release.B.js?release=release.B'
		),
		clients: { get: vi.fn(async () => ({ url: 'https://app.test/' })) },
		addEventListener: (type: string, listener: (event: any) => void) => {
			listeners[type] = listener;
		},
	});
	vi.stubGlobal('caches', {
		open: async () => ({
			put: async (url: URL, response: Response) => {
				stored.set(url.href, response);
			},
			match: async (url: URL) => stored.get(url.href)?.clone(),
		}),
	});
});
afterEach(() => vi.unstubAllGlobals());

it('retains a document release across worker replacement and restart', async () => {
	(await import('./app-service-worker')).installAppServiceWorker();
	let pending: Promise<void> | undefined;
	listeners['message']({
		data: { type: 'playground-pin-release', root: '/releases/release.A/' },
		source: { id: 'existing-document' },
		ports: [],
		waitUntil: (promise: Promise<void>) => {
			pending = promise;
		},
	});
	await pending;
	vi.resetModules();
	(await import('./app-service-worker')).installAppServiceWorker();
	const response = fetchEvent(
		'/wp-6.9/wordpress-static.zip',
		'existing-document'
	);
	expect(await (await response).text()).toBe(
		'https://app.test/releases/release.A/wp-6.9/wordpress-static.zip'
	);
});

it('derives a PHP worker release from its explicit script URL', async () => {
	vi.mocked(
		(self as unknown as ServiceWorkerGlobalScope).clients.get
	).mockResolvedValue({
		url: 'https://app.test/releases/release.A/assets/php-worker.js',
	} as Client);
	(await import('./app-service-worker')).installAppServiceWorker();
	expect(
		await (await fetchEvent('/assets/php.wasm', 'php-worker')).text()
	).toBe('https://app.test/releases/release.A/assets/php.wasm');
});

it('rejects WordPress execution on the app origin independently of asset selection', async () => {
	(await import('./app-service-worker')).installAppServiceWorker();
	expect(
		(await fetchEvent('/scope:site-a/index.php', 'document')).status
	).toBe(404);
});

it('never intercepts immutable worker installation URLs', async () => {
	(await import('./app-service-worker')).installAppServiceWorker();
	for (const path of ['/app-sw-release.A.js', '/sandbox-sw-release.A.js']) {
		const respondWith = vi.fn();
		listeners['fetch']({
			request: new Request('https://app.test' + path),
			respondWith,
		});
		expect(respondWith).not.toHaveBeenCalled();
	}
});

function fetchEvent(path: string, clientId: string): Promise<Response> {
	let response!: Promise<Response>;
	listeners['fetch']({
		request: new Request('https://app.test' + path),
		clientId,
		respondWith: (value: Promise<Response> | Response) => {
			response = Promise.resolve(value);
		},
	});
	return response;
}

it('refreshes the root selector instead of resolving it inside a document release', async () => {
	(await import('./app-service-worker')).installAppServiceWorker();
	expect(await (await fetchEvent('/', 'document')).text()).toBe('bootstrap');
});
