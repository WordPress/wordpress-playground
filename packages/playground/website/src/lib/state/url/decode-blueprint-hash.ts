/**
 * Decodes a Playground URL hash fragment into the blueprint string
 * downstream code expects to JSON-parse.
 *
 * `decodeURI` runs first because it leaves reserved characters like
 * `%26`, `%3F`, `%2F` alone. Some hand-crafted URLs keep them inside
 * blueprint string values deliberately — the target server may
 * distinguish `?q=a%26b` from `?q=a&b`, and changing one to the other
 * silently changes what the blueprint does.
 *
 * `decodeURIComponent` runs only when the `decodeURI` result fails to
 * parse as JSON. This catches fragments built with
 * `encodeURIComponent(JSON.stringify(blueprint))` — the natural thing
 * for external tooling to reach for — where surviving `%3A`/`%2C`/`%22`
 * would otherwise break parsing and surface an unhelpful
 * "Invalid blueprint" error.
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

	let decodedURI: string | undefined;
	try {
		decodedURI = decodeURI(stripped);
		JSON.parse(decodedURI);
		return decodedURI;
	} catch {
		// `decodeURI` threw on malformed %XX, or the result is not JSON
		// — try `decodeURIComponent` next.
	}

	try {
		return decodeURIComponent(stripped);
	} catch {
		// `decodeURIComponent` also threw. Return whatever `decodeURI`
		// gave us (if anything) so downstream parsing reports a useful
		// error; otherwise hand back the raw hash.
		return decodedURI ?? stripped;
	}
}
