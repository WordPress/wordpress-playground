import { decodeBlueprintHash } from './decode-blueprint-hash';
import type { SiteInfo } from '../redux/slice-sites';
import {
	parseFileBrowserQuery,
	resolveFileBrowserPath,
	shouldUseFileBrowserQuery,
} from './filebrowser-query';
import {
	parseBlueprint,
	PlaygroundRoute,
	isSiteSavingDisabled,
} from './router';

const toBase64 = (s: string) =>
	typeof btoa === 'function'
		? btoa(s)
		: // eslint-disable-next-line @typescript-eslint/no-explicit-any
			(globalThis as any).Buffer.from(s, 'utf-8').toString('base64');

// `parseBlueprint` reaches into `window.atob` via the existing
// `decodeBase64ToString` helper. The default vitest environment for this
// package is `node`, so we polyfill the bits the helper actually touches.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;
if (typeof g.window === 'undefined') {
	g.window = {
		atob: (s: string) => Buffer.from(s, 'base64').toString('binary'),
	};
}

describe('decodeBlueprintHash', () => {
	const blueprint = {
		landingPage: '/?p=4',
		steps: [{ step: 'login', username: 'admin', password: 'password' }],
	};

	it('decodes fragments produced by encodeURI (the in-tree encoder)', () => {
		const raw = '#' + encodeURI(JSON.stringify(blueprint));
		expect(JSON.parse(decodeBlueprintHash(raw))).toEqual(blueprint);
	});

	it('decodes fragments produced by encodeURIComponent (external tooling)', () => {
		const raw = '#' + encodeURIComponent(JSON.stringify(blueprint));
		expect(JSON.parse(decodeBlueprintHash(raw))).toEqual(blueprint);
	});

	it('decodes near-raw JSON where the browser only encoded quotes', () => {
		const raw = '#{%22landingPage%22:%22/%22}';
		expect(JSON.parse(decodeBlueprintHash(raw))).toEqual({
			landingPage: '/',
		});
	});

	it('round-trips a literal & inside a blueprint value', () => {
		// encodeURIComponent encodes `&` as `%26`; decodeURIComponent
		// reverses that, so the author's original `&` survives.
		const blueprint = { url: 'https://x.test/?q=a&b' };
		const raw = '#' + encodeURIComponent(JSON.stringify(blueprint));
		expect(JSON.parse(decodeBlueprintHash(raw))).toEqual(blueprint);
	});

	it('returns non-JSON hashes unchanged', () => {
		expect(decodeBlueprintHash('#not-json')).toBe('not-json');
	});

	it('handles raw hash without leading #', () => {
		expect(decodeBlueprintHash('not-json')).toBe('not-json');
	});

	it('returns empty string for empty hash', () => {
		expect(decodeBlueprintHash('#')).toBe('');
		expect(decodeBlueprintHash('')).toBe('');
	});

	it('survives malformed %XX without throwing', () => {
		// `decodeURI` and `decodeURIComponent` both throw URIError on `%`
		// not followed by two hex digits. The helper should swallow the
		// error and return the raw fragment so downstream parsing
		// produces a useful error.
		const malformed = '#%E0%A4%A';
		expect(() => decodeBlueprintHash(malformed)).not.toThrow();
	});
});

describe('parseBlueprint', () => {
	const blueprint = {
		landingPage: '/?p=4',
		steps: [{ step: 'login', username: 'admin', password: 'password' }],
	};

	it('parses plain JSON', () => {
		expect(parseBlueprint(JSON.stringify(blueprint))).toEqual(blueprint);
	});

	it('parses base64-encoded JSON', () => {
		expect(parseBlueprint(toBase64(JSON.stringify(blueprint)))).toEqual(
			blueprint
		);
	});

	it('throws a descriptive error for invalid JSON and includes the underlying message', () => {
		expect(() => parseBlueprint('{not json')).toThrow(
			/Invalid blueprint\./
		);
		expect(() => parseBlueprint('{not json')).toThrow(
			/Invalid blueprint\.\s+\S/
		);
	});

	it('hints at double-encoding when the input still contains %XX escapes', () => {
		const halfDecoded = '{"landingPage"%3A"/"}';
		expect(() => parseBlueprint(halfDecoded)).toThrow(/double-encoded/);
	});
});

describe('parseFileBrowserQuery', () => {
	it('parses a valueless filebrowser parameter', () => {
		expect(
			parseFileBrowserQuery(new URLSearchParams('filebrowser'))
		).toEqual({
			isRequested: true,
			path: null,
			line: null,
			error: null,
		});
	});

	it('parses a document-root-relative file path', () => {
		expect(
			parseFileBrowserQuery(
				new URLSearchParams(
					'filebrowser=wp-content/plugins/foo/index.php'
				)
			)
		).toEqual({
			isRequested: true,
			path: 'wp-content/plugins/foo/index.php',
			line: null,
			error: null,
		});
	});

	it('parses a document-root-relative file path with a line number', () => {
		expect(
			parseFileBrowserQuery(
				new URLSearchParams(
					'filebrowser=wp-content/plugins/foo/index.php:20'
				)
			)
		).toEqual({
			isRequested: true,
			path: 'wp-content/plugins/foo/index.php',
			line: 20,
			error: null,
		});
	});

	it('parses encoded paths and line numbers', () => {
		expect(
			parseFileBrowserQuery(
				new URLSearchParams(
					'filebrowser=wp-content%2Fplugins%2Ffoo%20bar%2Findex.php%3A20'
				)
			)
		).toEqual({
			isRequested: true,
			path: 'wp-content/plugins/foo bar/index.php',
			line: 20,
			error: null,
		});
	});

	it('normalizes safe relative path inputs', () => {
		expect(
			parseFileBrowserQuery(
				new URLSearchParams(
					'filebrowser=./wp-content/plugins/foo/../foo/index.php'
				)
			)
		).toEqual({
			isRequested: true,
			path: 'wp-content/plugins/foo/index.php',
			line: null,
			error: null,
		});
	});

	it('rejects traversal outside the document root', () => {
		const parsed = parseFileBrowserQuery(
			new URLSearchParams('filebrowser=wp-content/../../wp-config.php')
		);

		expect(parsed.isRequested).toBe(true);
		expect(parsed.path).toBe(null);
		expect(parsed.line).toBe(null);
		expect(parsed.error).toContain(
			'relative to the WordPress document root'
		);
	});

	it('rejects absolute paths', () => {
		const parsed = parseFileBrowserQuery(
			new URLSearchParams('filebrowser=/wordpress/wp-config.php')
		);

		expect(parsed.isRequested).toBe(true);
		expect(parsed.path).toBe(null);
		expect(parsed.error).toContain(
			'relative to the WordPress document root'
		);
	});

	it('rejects missing paths with line suffixes', () => {
		const parsed = parseFileBrowserQuery(
			new URLSearchParams('filebrowser=:20')
		);

		expect(parsed.isRequested).toBe(true);
		expect(parsed.path).toBe(null);
		expect(parsed.line).toBe(null);
		expect(parsed.error).toContain(
			'relative to the WordPress document root'
		);
	});
});

describe('resolveFileBrowserPath', () => {
	it('resolves parsed paths under the document root', () => {
		expect(
			resolveFileBrowserPath(
				'/wordpress',
				'wp-content/plugins/foo/index.php'
			)
		).toBe('/wordpress/wp-content/plugins/foo/index.php');
	});
});

describe('shouldUseFileBrowserQuery', () => {
	it('is true for normal UI requests', () => {
		expect(
			shouldUseFileBrowserQuery(new URLSearchParams('filebrowser'), false)
		).toBe(true);
	});

	it('does not apply in seamless mode', () => {
		expect(
			shouldUseFileBrowserQuery(
				new URLSearchParams('filebrowser&mode=seamless'),
				false
			)
		).toBe(false);
	});

	it('does not apply in embedded iframe UI', () => {
		expect(
			shouldUseFileBrowserQuery(new URLSearchParams('filebrowser'), true)
		).toBe(false);
	});
});

describe('PlaygroundRoute.site', () => {
	it('preserves filebrowser when routing to a saved site', () => {
		const url = PlaygroundRoute.site(
			{
				slug: 'saved-site',
				metadata: {
					storage: 'opfs',
				},
			} as unknown as SiteInfo,
			'https://playground.test/?filebrowser=wp-content/plugins/foo/index.php'
		);

		expect(new URL(url).searchParams.get('filebrowser')).toBe(
			'wp-content/plugins/foo/index.php'
		);
	});

	it('preserves filebrowser without absorbing the URL hash', () => {
		const url = PlaygroundRoute.site(
			{
				slug: 'saved-site',
				metadata: {
					storage: 'opfs',
				},
			} as unknown as SiteInfo,
			'https://playground.test/?filebrowser=wp-content/plugins/foo/index.php#%7B%22steps%22%3A%5B%5D%7D'
		);

		const nextUrl = new URL(url);
		expect(nextUrl.searchParams.get('filebrowser')).toBe(
			'wp-content/plugins/foo/index.php'
		);
		expect(nextUrl.hash).toBe('');
	});
});

describe('PlaygroundRoute site creation routes', () => {
	it('marks new temporary site URLs with storage=temp', () => {
		const url = PlaygroundRoute.newTemporarySite(
			{},
			'https://playground.test/website-server/'
		);
		expect(new URL(url).searchParams.get('storage')).toBe('temp');
	});

	it('does not mark default new site URLs as temporary', () => {
		const url = PlaygroundRoute.newSite(
			{},
			'https://playground.test/website-server/?storage=temp'
		);
		expect(new URL(url).searchParams.get('storage')).toBeNull();
	});

	it('replaces the current setup when creating a new site URL', () => {
		const url = new URL(
			PlaygroundRoute.newSite(
				{
					query: { php: '8.3' },
				},
				'https://playground.test/website-server/?storage=temp&wp=6.6#old'
			)
		);

		expect(url.searchParams.get('php')).toBe('8.3');
		expect(url.searchParams.get('random')).not.toBeNull();
		expect(url.searchParams.get('storage')).toBeNull();
		expect(url.searchParams.get('wp')).toBeNull();
		expect(url.hash).toBe('');
	});

	it('preserves Query API version settings when selecting a saved site', () => {
		const url = PlaygroundRoute.site(
			{
				slug: 'saved-site',
				metadata: {
					storage: 'opfs',
				},
			} as unknown as SiteInfo,
			'https://playground.test/website-server/?url=/wp-admin/&php=8.0&wp=6.6'
		);
		const params = new URL(url).searchParams;
		expect(params.get('site-slug')).toBe('saved-site');
		expect(params.get('url')).toBe('/wp-admin/');
		expect(params.get('php')).toBe('8.0');
		expect(params.get('wp')).toBe('6.6');
	});
});

describe('isSiteSavingDisabled', () => {
	const topWindow = {};
	const regularWindow = {} as unknown as Window;
	Object.defineProperties(regularWindow, {
		self: { value: regularWindow },
		top: { value: regularWindow },
	});
	const embeddedWindow = {} as unknown as Window;
	Object.defineProperties(embeddedWindow, {
		self: { value: embeddedWindow },
		top: { value: topWindow },
	});

	it('allows saving by default', () => {
		expect(
			isSiteSavingDisabled(
				new URL('https://playground.test/'),
				regularWindow
			)
		).toBe(false);
	});

	it('disables saving when can-save=no', () => {
		expect(
			isSiteSavingDisabled(
				new URL('https://playground.test/?can-save=no'),
				regularWindow
			)
		).toBe(true);
	});

	it('disables saving in seamless mode', () => {
		expect(
			isSiteSavingDisabled(
				new URL('https://playground.test/?mode=seamless'),
				regularWindow
			)
		).toBe(true);
	});

	it('disables saving when embedded in another iframe', () => {
		expect(
			isSiteSavingDisabled(
				new URL('https://playground.test/'),
				embeddedWindow
			)
		).toBe(true);
	});

	it('treats inaccessible iframe parents as embedded', () => {
		const crossOriginWindow = {
			self: {},
			get top() {
				throw new Error('Cross-origin parent');
			},
		} as unknown as Window;

		expect(
			isSiteSavingDisabled(
				new URL('https://playground.test/'),
				crossOriginWindow
			)
		).toBe(true);
	});
});
