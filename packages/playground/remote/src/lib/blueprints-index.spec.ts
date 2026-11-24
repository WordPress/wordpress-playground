import type * as OfflineCache from './offline-mode-cache';

vi.mock('virtual:remote-config', () => ({ buildVersion: 'test' }));

const indexUrl =
	'https://raw.githubusercontent.com/WordPress/blueprints/trunk/index.json';

describe('Blueprints directory index', () => {
	let fetchBlueprintsIndex: typeof OfflineCache.fetchBlueprintsIndex;
	let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
	let cachePut: ReturnType<typeof vi.fn>;

	beforeEach(async () => {
		vi.resetModules();
		const entries = new Map<string, Response>();
		cachePut = vi.fn(async (url: string, response: Response) => {
			entries.set(url, response.clone());
		});
		vi.stubGlobal('caches', {
			open: vi.fn().mockResolvedValue({
				put: cachePut,
				match: vi.fn(async (url: string) => entries.get(url)?.clone()),
			}),
		});
		fetchMock = vi.fn<typeof fetch>();
		vi.stubGlobal('fetch', fetchMock);
		({ fetchBlueprintsIndex } = await import('./offline-mode-cache'));
	});

	afterEach(() => vi.unstubAllGlobals());

	it('fetches only the fixed index and rebuilds the response as non-executable JSON', async () => {
		const index = { example: { title: '<script>alert(1)</script>' } };
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify(index), {
				headers: {
					'Content-Type': 'text/html',
					'Set-Cookie': 'untrusted=value',
				},
			})
		);

		const response = await fetchBlueprintsIndex();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(indexUrl, {
			cache: 'no-store',
			credentials: 'omit',
		});
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('application/json');
		expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
		expect(response.headers.has('Set-Cookie')).toBe(false);
		expect(await response.json()).toEqual(index);
	});

	it('refreshes the cached index when the network has a newer copy', async () => {
		fetchMock.mockResolvedValueOnce(Response.json({ version: 1 }));
		await fetchBlueprintsIndex();
		fetchMock.mockResolvedValueOnce(Response.json({ version: 2 }));

		expect(await (await fetchBlueprintsIndex()).json()).toEqual({
			version: 2,
		});
		fetchMock.mockRejectedValueOnce(new TypeError('Offline'));
		expect(await (await fetchBlueprintsIndex()).json()).toEqual({
			version: 2,
		});
	});

	it.each(['offline', 'HTTP error', 'HTML body'])(
		'keeps the last valid JSON response when fetching fails with %s',
		async (failure) => {
			fetchMock.mockResolvedValueOnce(Response.json({ example: {} }));
			await fetchBlueprintsIndex();
			if (failure === 'offline') {
				fetchMock.mockRejectedValueOnce(new TypeError('Offline'));
			} else {
				fetchMock.mockResolvedValueOnce(
					new Response('<script>alert(1)</script>', {
						status: failure === 'HTTP error' ? 503 : 200,
						headers: { 'Content-Type': 'text/html' },
					})
				);
			}

			const response = await fetchBlueprintsIndex();

			expect(await response.json()).toEqual({ example: {} });
			expect(response.headers.get('Content-Type')).toBe(
				'application/json'
			);
			expect(response.headers.get('X-Content-Type-Options')).toBe(
				'nosniff'
			);
			expect(cachePut).toHaveBeenCalledTimes(1);
		}
	);

	it('returns fresh JSON when writing the offline cache fails', async () => {
		fetchMock.mockResolvedValueOnce(Response.json({ example: {} }));
		cachePut.mockRejectedValueOnce(
			new DOMException('Full', 'QuotaExceededError')
		);

		expect(await (await fetchBlueprintsIndex()).json()).toEqual({
			example: {},
		});
	});

	it('returns a plain error instead of upstream HTML when no cached index exists', async () => {
		fetchMock.mockResolvedValueOnce(
			new Response('<script>alert(1)</script>', {
				headers: { 'Content-Type': 'text/html' },
			})
		);

		const response = await fetchBlueprintsIndex();

		expect(response.status).toBe(502);
		expect(response.headers.get('Content-Type')).toBe(
			'text/plain;charset=UTF-8'
		);
		expect(await response.text()).not.toContain('<script>');
		expect(cachePut).not.toHaveBeenCalled();
	});
});
