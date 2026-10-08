import type * as OfflineCache from './offline-mode-cache';

vi.mock('virtual:remote-config', () => ({ buildVersion: 'test' }));

describe('offline asset scope', () => {
	let shouldCacheUrl: typeof OfflineCache.shouldCacheUrl;
	beforeAll(async () => {
		vi.stubGlobal('caches', { open: vi.fn().mockResolvedValue({}) });
		vi.stubGlobal('self', {
			location: new URL('https://playground.test:9443'),
		});
		({ shouldCacheUrl } = await import('./offline-mode-cache'));
	});
	afterAll(() => vi.unstubAllGlobals());

	it('does not replay API responses from a WordPress site on another port', () => {
		expect(
			shouldCacheUrl(new URL('https://playground.test:9443/app.js'))
		).toBe(true);
		expect(
			shouldCacheUrl(new URL('https://playground.test:9417/?reprint-api'))
		).toBe(false);
		expect(
			shouldCacheUrl(new URL('http://playground.test:9443/?reprint-api'))
		).toBe(false);
	});
});

describe('Wasm offline storage', () => {
	const wasmUrl = 'https://playground.test:9443/assets/php.wasm';
	const wasmBytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
	let offline: typeof OfflineCache;
	let root: TestDirectory;
	let cache: {
		match: ReturnType<typeof vi.fn>;
		put: ReturnType<typeof vi.fn>;
	};
	let storedResponses: Map<string, Uint8Array>;
	let backgroundWrites: Promise<unknown>[];
	let event: ExtendableEvent;

	beforeEach(async () => {
		vi.resetModules();
		root = new TestDirectory();
		storedResponses = new Map();
		cache = {
			match: vi.fn(async (request: Request | string) => {
				const bytes = storedResponses.get(
					typeof request === 'string' ? request : request.url
				);
				return bytes ? new Response(bytes) : undefined;
			}),
			put: vi.fn(
				async (request: Request | string, response: Response) => {
					storedResponses.set(
						typeof request === 'string' ? request : request.url,
						new Uint8Array(await response.arrayBuffer())
					);
				}
			),
		};
		vi.stubGlobal('caches', {
			open: vi.fn().mockResolvedValue(cache),
			keys: vi.fn().mockResolvedValue([]),
		});
		vi.stubGlobal('self', {
			location: new URL('https://playground.test:9443/sw.js'),
			serviceWorker: { state: 'activated' },
		});
		vi.stubGlobal('navigator', {
			storage: { getDirectory: vi.fn().mockResolvedValue(root) },
		});
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(wasmBytes))
		);
		backgroundWrites = [];
		event = {
			waitUntil: vi.fn((promise) => backgroundWrites.push(promise)),
		} as unknown as ExtendableEvent;
		offline = await import('./offline-mode-cache');
	});

	afterEach(() => vi.unstubAllGlobals());

	it('reuses a streamed OPFS download without fetching or duplicating it in CacheStorage', async () => {
		const response = await offline.cacheFirstFetch(
			new Request(wasmUrl),
			event
		);
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(wasmBytes);
		await Promise.all(backgroundWrites);
		expect(cache.put).not.toHaveBeenCalled();
		expect(await offline.hasCachedResponse(wasmUrl)).toBe(true);

		const cached = await offline.cacheFirstFetch(
			new Request(wasmUrl),
			event
		);
		expect(cached.headers.get('content-length')).toBe('8');
		await expect(
			WebAssembly.compileStreaming(cached)
		).resolves.toBeInstanceOf(WebAssembly.Module);
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('returns the live stream before the OPFS write finishes', async () => {
		let download!: ReadableStreamDefaultController<Uint8Array>;
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(
				new ReadableStream({
					start: (controller) => (download = controller),
				})
			)
		);
		const response = await offline.cacheFirstFetch(
			new Request(wasmUrl),
			event
		);
		expect(event.waitUntil).toHaveBeenCalledTimes(1);
		const reader = response.body!.getReader();
		download.enqueue(wasmBytes.subarray(0, 4));
		expect((await reader.read()).value).toEqual(wasmBytes.subarray(0, 4));
		expect(await offline.hasCachedResponse(wasmUrl)).toBe(false);
		download.enqueue(wasmBytes.subarray(4));
		download.close();
		await reader.read();
		await reader.read();
		await Promise.all(backgroundWrites);
		expect(await offline.hasCachedResponse(wasmUrl)).toBe(true);
	});

	it('does not rewrite a complete file when the PHP worker caches the same URL again', async () => {
		await offline.putCachedResponse(wasmUrl, new Response(wasmBytes));
		const directory = root.directories
			.get('playground-wasm-cache')!
			.directories.get('test')!;
		expect(directory.writes).toBe(1);
		await offline.putCachedResponse(wasmUrl, new Response(wasmBytes));
		expect(directory.writes).toBe(1);
	});

	it.each(['unavailable', 'denied', 'quota'])(
		'falls back to CacheStorage when OPFS is %s',
		async (failure) => {
			if (failure === 'unavailable') {
				vi.stubGlobal('navigator', {});
			} else if (failure === 'denied') {
				vi.mocked(navigator.storage.getDirectory).mockRejectedValue(
					new Error('Denied')
				);
			} else {
				root.failWrites = true;
			}
			await offline.cacheFirstFetch(new Request(wasmUrl), event);
			await Promise.all(backgroundWrites);
			expect(cache.put).toHaveBeenCalledTimes(1);
			expect(await offline.hasCachedResponse(wasmUrl)).toBe(true);
			const cached = await offline.cacheFirstFetch(
				new Request(wasmUrl),
				event
			);
			expect(new Uint8Array(await cached.arrayBuffer())).toEqual(
				wasmBytes
			);
			expect(fetch).toHaveBeenCalledTimes(1);
		}
	);

	it('does not publish an interrupted download', async () => {
		const { putCachedWasm, getCachedWasm } = await import('./wasm-cache');
		let download!: ReadableStreamDefaultController<Uint8Array>;
		const response = new Response(
			new ReadableStream({
				start: (controller) => (download = controller),
			})
		);
		const write = putCachedWasm(wasmUrl, response);
		download.enqueue(wasmBytes.subarray(0, 4));
		download.error(new Error('Disconnected'));
		expect(await write).toBe(false);
		expect(await getCachedWasm(wasmUrl)).toBeUndefined();
		await offline.cacheFirstFetch(new Request(wasmUrl), event);
		await Promise.all(backgroundWrites);
		expect(await offline.hasCachedResponse(wasmUrl)).toBe(true);
	});

	it('keeps distinct paths and queries separate', async () => {
		await offline.putCachedResponse(wasmUrl, new Response(wasmBytes));
		const { getCachedWasm } = await import('./wasm-cache');
		expect(
			await getCachedWasm(wasmUrl.replace('/assets/', '/other/'))
		).toBeUndefined();
		expect(await getCachedWasm(`${wasmUrl}?variant=other`)).toBeUndefined();
		expect(await getCachedWasm(`${wasmUrl}#ignored`)).toBeDefined();
	});

	it.each([
		'https://another.test/assets/php.wasm',
		'https://playground.test:9417/assets/php.wasm',
		'https://playground.test:9443/scope:site/php.wasm',
		'https://playground.test:9443/assets/app.js',
	])('does not put %s in the OPFS cache', async (url) => {
		await offline.putCachedResponse(url, new Response(wasmBytes));
		expect(root.directories.size).toBe(0);
		expect(cache.put).toHaveBeenCalledTimes(1);
	});

	it.each([
		new Response('partial', { status: 206 }),
		new Response('partial', {
			headers: { 'Content-Range': 'bytes 0-3/8' },
		}),
		new Response('not found', { status: 404 }),
	])(
		'does not put partial or unsuccessful responses in OPFS',
		async (response) => {
			await offline.putCachedResponse(wasmUrl, response);
			expect(root.directories.size).toBe(0);
		}
	);

	it('does not replay a GET download for a POST request', async () => {
		await offline.putCachedResponse(wasmUrl, new Response(wasmBytes));
		cache.match.mockResolvedValue(undefined);
		await offline.cacheFirstFetch(
			new Request(wasmUrl, { method: 'POST' }),
			event
		);
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(event.waitUntil).not.toHaveBeenCalled();
	});

	it('purges only previous Wasm releases and keeps saved sites', async () => {
		const wasmCache = await root.getDirectoryHandle(
			'playground-wasm-cache',
			{ create: true }
		);
		await wasmCache.getDirectoryHandle('previous', { create: true });
		await wasmCache.getDirectoryHandle('test', { create: true });
		const sites = await root.getDirectoryHandle('sites', { create: true });
		await sites.getDirectoryHandle('my-site', { create: true });
		await offline.purgeEverythingFromPreviousRelease();
		expect([...wasmCache.directories.keys()]).toEqual(['test']);
		expect([...sites.directories.keys()]).toEqual(['my-site']);
	});
});

/** Models OPFS publication: new bytes become visible only when the writer closes. */
class TestDirectory {
	directories = new Map<string, TestDirectory>();
	files = new Map<string, File>();
	failWrites = false;
	writes = 0;

	async getDirectoryHandle(name: string, { create = false } = {}) {
		if (!this.directories.has(name)) {
			if (!create) {
				throw new Error('Not found');
			}
			const directory = new TestDirectory();
			directory.failWrites = this.failWrites;
			this.directories.set(name, directory);
		}
		return this.directories.get(name)!;
	}

	async getFileHandle(name: string, { create = false } = {}) {
		if (!this.files.has(name)) {
			if (!create) {
				throw new Error('Not found');
			}
			this.files.set(name, new File([], name));
		}
		return {
			getFile: async () => this.files.get(name)!,
			createWritable: async () => {
				this.writes++;
				const chunks: Uint8Array[] = [];
				return new WritableStream<Uint8Array>({
					write: (chunk) => {
						if (this.failWrites) {
							throw new Error('Quota exceeded');
						}
						chunks.push(chunk);
					},
					close: () => {
						this.files.set(name, new File(chunks, name));
					},
				});
			},
		};
	}

	async *keys() {
		yield* this.directories.keys();
	}

	async removeEntry(name: string) {
		this.directories.delete(name);
	}
}
