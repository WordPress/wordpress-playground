import {
	parseBlueprint,
	PlaygroundRoute,
	isSiteSavingDisabled,
} from './router';
import { decodeBlueprintHash } from './decode-blueprint-hash';
import type { SiteInfo } from '../redux/slice-sites';

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

	it('returns non-JSON hashes unchanged (e.g. last-autosave)', () => {
		expect(decodeBlueprintHash('#last-autosave')).toBe('last-autosave');
	});

	it('handles raw hash without leading #', () => {
		expect(decodeBlueprintHash('last-autosave')).toBe('last-autosave');
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
