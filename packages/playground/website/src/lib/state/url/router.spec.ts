import { parseBlueprint } from './router';
import { decodeBlueprintHash } from './decode-blueprint-hash';

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
	g.window = { atob: (s: string) => Buffer.from(s, 'base64').toString('binary') };
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
		expect(() => parseBlueprint('{not json')).toThrow(/Invalid blueprint\./);
		expect(() => parseBlueprint('{not json')).toThrow(
			/Invalid blueprint\.\s+\S/
		);
	});

	it('hints at double-encoding when the input still contains %XX escapes', () => {
		const halfDecoded = '{"landingPage"%3A"/"}';
		expect(() => parseBlueprint(halfDecoded)).toThrow(/double-encoded/);
	});
});
