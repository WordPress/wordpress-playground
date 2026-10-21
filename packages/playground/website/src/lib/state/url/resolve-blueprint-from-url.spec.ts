import { vi, afterEach, expect, it } from 'vitest';
import {
	getBlueprintDeclaration,
	isBlueprintBundle,
} from '@wp-playground/client';
import { resolveBlueprintFromURL } from './resolve-blueprint-from-url';

vi.hoisted(() => {
	vi.stubGlobal('location', new URL('https://playground.test/'));
});

vi.mock('virtual:cors-proxy-url', () => ({
	corsProxyUrl: 'https://playground.test/cors-proxy.php?',
}));

afterEach(() => vi.unstubAllGlobals());

it.each(['query', 'default'])(
	'retries a %s startup Blueprint through the proxy after a CORS failure',
	async (source) => {
		const blueprintUrl = 'https://site.test/_playground/blueprint.json';
		const blueprint = { landingPage: '/wp-admin/', steps: [] };
		const fetchMock = vi.fn(async (request: Request) => {
			if (request.url === blueprintUrl) {
				throw new TypeError('Failed to fetch');
			}
			expect(request.url).toBe(
				`https://playground.test/cors-proxy.php?${blueprintUrl}`
			);
			return new Response(JSON.stringify(blueprint), {
				headers: { 'X-Playground-Cors-Proxy': 'true' },
			});
		});
		vi.stubGlobal('fetch', fetchMock);
		vi.stubGlobal('document', {
			location: { href: 'https://playground.test/' },
		});
		const url = new URL('https://playground.test/');
		if (source === 'query') {
			url.searchParams.set('blueprint-url', blueprintUrl);
		}
		const window = { location: url };
		vi.stubGlobal('window', { ...window, self: window, top: window });
		const resolved = await resolveBlueprintFromURL(
			url,
			source === 'default' ? blueprintUrl : undefined
		);
		if (!isBlueprintBundle(resolved.blueprint)) {
			throw new Error('Expected a remote Blueprint bundle');
		}
		expect(await getBlueprintDeclaration(resolved.blueprint)).toEqual(
			blueprint
		);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	}
);
