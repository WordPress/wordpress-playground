/**
 * Decodes a Playground URL hash fragment into the blueprint string
 * downstream code expects to JSON-parse.
 *
 * `decodeURIComponent` runs first because it correctly reverses the
 * encoder most external tooling uses — `encodeURIComponent`, the
 * natural choice when serializing a blueprint as a URL fragment. It
 * decodes both ordinary characters (`%C4%85` → `ą`) and the URL-
 * reserved set (`%2F` → `/`, `%3A` → `:`, `%26` → `&`).
 *
 * `decodeURI` runs only when `decodeURIComponent` fails to produce
 * parseable JSON. That keeps backwards compatibility with older
 * Playground URLs that depend on `decodeURI` leaving reserved
 * characters alone.
 *
 * Malformed `%XX` makes both decoders throw; we swallow that and hand
 * back the best string we have, so the downstream JSON parser produces
 * a useful error instead of an opaque `URIError`.
 *
 * Kept in its own file so tests can import it without pulling in the
 * rest of the app's runtime. A near-identical twin lives in the
 * personal-wp tree; keep the two in sync.
 */
export function decodeBlueprintHash(rawHash: string): string {
	const stripped = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;

	let decodedComponent: string | undefined;
	try {
		decodedComponent = decodeURIComponent(stripped);
		JSON.parse(decodedComponent);
		return decodedComponent;
	} catch {
		// `decodeURIComponent` threw on malformed %XX, or the result
		// is not JSON — fall back to `decodeURI` for legacy URLs.
	}

	try {
		return decodeURI(stripped);
	} catch {
		// Both decoders failed. Hand back whatever `decodeURIComponent`
		// produced (if anything) so the downstream JSON parser reports
		// a useful error; otherwise return the raw hash.
		return decodedComponent ?? stripped;
	}
}
