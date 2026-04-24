import { parseBlueprint } from './router';
import { decodeBlueprintHash } from './resolve-blueprint-from-url';

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

	it('preserves %26 intentionally kept inside a URL value', () => {
		// A hand-crafted URL where the author wants %26 to round-trip —
		// e.g. targeting an API that distinguishes `?q=a%26b` from
		// `?q=a&b`. The fragment is the browser's view of the raw hash:
		// `"` arrives as %22 but `%26` is preserved as-is.
		const raw = '#{%22url%22:%22https://x.test/?q=a%26b%22}';
		expect(JSON.parse(decodeBlueprintHash(raw))).toEqual({
			url: 'https://x.test/?q=a%26b',
		});
	});

	it('returns non-JSON hashes unchanged (e.g. last-autosave)', () => {
		expect(decodeBlueprintHash('#last-autosave')).toBe('last-autosave');
	});

	it('returns empty string for empty hash', () => {
		expect(decodeBlueprintHash('#')).toBe('');
		expect(decodeBlueprintHash('')).toBe('');
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
		const base64 = Buffer.from(JSON.stringify(blueprint)).toString('base64');
		expect(parseBlueprint(base64)).toEqual(blueprint);
	});

	it('throws a descriptive error for invalid JSON and includes the underlying message', () => {
		expect(() => parseBlueprint('{not json')).toThrow(/Invalid blueprint:/);
		expect(() => parseBlueprint('{not json')).not.toThrow(
			/^Invalid blueprint$/
		);
	});

	it('hints at double-encoding when the input still contains %XX escapes', () => {
		// decodeBlueprintHash normally handles this, but if a caller passes a
		// still-encoded string directly, the error should steer them.
		const halfDecoded = '{"landingPage"%3A"/"}';
		expect(() => parseBlueprint(halfDecoded)).toThrow(/double-encoded/);
	});
});
