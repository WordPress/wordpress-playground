import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('./config', () => ({
	playgroundOrigin: 'https://app.test',
	wordPressSiteUrl: 'https://wordpress.test',
	assetBaseUrl: new URL('https://app.test/releases/release.B/'),
}));
vi.mock('./offline-mode-cache', () => ({
	cacheFirstFetch: vi.fn(
		async (request: Request) => new Response(request.url)
	),
	networkFirstFetch: vi.fn(async () => new Response('bootstrap')),
	fetchBlueprintsIndex: vi.fn(),
	cacheOfflineModeAssetsForCurrentRelease: vi.fn(),
	shouldCacheUrl: () => true,
	pruneOfflineModeCaches: vi.fn(),
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
		clients: {
			get: vi.fn(async () => ({ url: 'https://app.test/' })),
			matchAll: vi.fn(async () => []),
		},
		addEventListener: (type: string, listener: (event: any) => void) => {
			listeners[type] = listener;
		},
	});
	vi.stubGlobal('caches', {
		open: async () => ({
			put: async (url: URL, response: Response) => {
				stored.set(url.href, response);
			},
			match: async (url: URL | Request) =>
				stored.get('href' in url ? url.href : url.url)?.clone(),
			keys: async () => [...stored.keys()].map((url) => new Request(url)),
			delete: async (request: Request) => stored.delete(request.url),
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

it('refreshes root pages that no document release has pinned', async () => {
	vi.mocked(
		(self as unknown as ServiceWorkerGlobalScope).clients.get
	).mockResolvedValue(undefined);
	(await import('./app-service-worker')).installAppServiceWorker();
	for (const path of ['/php-playground.html', '/builder/builder.html']) {
		expect(await (await fetchEvent(path, '')).text()).toBe('bootstrap');
	}
});

it('collects dead pins while retaining caches required by live documents and PHP workers', async () => {
	const { pruneOfflineModeCaches } = await import('./offline-mode-cache');
	const clients = (self as unknown as ServiceWorkerGlobalScope).clients;
	stored.set(
		'https://app.test/__client-release/closed',
		new Response('/releases/release.C/')
	);
	stored.set(
		'https://app.test/__client-release/live',
		new Response('/releases/release.A/')
	);
	vi.mocked(clients.get).mockImplementation(async (id) =>
		id === 'live' ? ({ id, url: 'https://app.test/' } as Client) : undefined
	);
	vi.mocked(clients.matchAll).mockResolvedValue([
		{ id: 'live', url: 'https://app.test/' },
		{
			id: 'php',
			url: 'https://app.test/releases/release.D/assets/php-worker.js',
		},
	] as Client[]);
	(await import('./app-service-worker')).installAppServiceWorker();
	let pending!: Promise<void>;
	listeners['activate']({
		waitUntil: (promise: Promise<void>) => {
			pending = promise;
		},
	});
	await pending;
	expect(stored.has('https://app.test/__client-release/closed')).toBe(false);
	expect(pruneOfflineModeCaches).toHaveBeenLastCalledWith(
		new Set([
			'/releases/release.B/',
			'/releases/release.A/',
			'/releases/release.D/',
		]),
		false
	);
	vi.mocked(clients.get).mockResolvedValue(undefined);
	vi.mocked(clients.matchAll).mockResolvedValue([]);
	listeners['activate']({
		waitUntil: (promise: Promise<void>) => {
			pending = promise;
		},
	});
	await pending;
	expect(stored.size).toBe(0);
	expect(pruneOfflineModeCaches).toHaveBeenLastCalledWith(
		new Set(['/releases/release.B/']),
		true
	);
});

it('replaces the previous build cache when a single-origin build activates beside open pages', async () => {
	vi.doMock('./config', () => ({
		playgroundOrigin: 'https://app.test',
		wordPressSiteUrl: 'https://app.test',
		assetBaseUrl: new URL('https://app.test/'),
	}));
	const { pruneOfflineModeCaches } = await import('./offline-mode-cache');
	vi.mocked(
		(self as unknown as ServiceWorkerGlobalScope).clients.matchAll
	).mockResolvedValue([{ id: 'page', url: 'https://app.test/' }] as Client[]);
	(await import('./app-service-worker')).installAppServiceWorker();
	const pending: Promise<void>[] = [];
	listeners['activate']({
		waitUntil: (promise: Promise<void>) => pending.push(promise),
	});
	await Promise.all(pending);
	expect(pending).toHaveLength(1);
	expect(pruneOfflineModeCaches).toHaveBeenLastCalledWith(undefined, true);
});
