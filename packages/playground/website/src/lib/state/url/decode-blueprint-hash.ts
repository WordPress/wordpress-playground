/**
 * Decodes the hash fragment of a Playground URL into a blueprint string.
 *
 * Preferred path: `decodeURI`, which preserves reserved chars like %26,
 * %3F, %2F that some authors intentionally keep inside URL values
 * embedded in their blueprint JSON.
 *
 * Fallback: `decodeURIComponent`, for fragments produced with
 * `encodeURIComponent(JSON.stringify(blueprint))` — a common pattern in
 * external tooling (GitHub Actions scripts, online examples). Under
 * `decodeURI` alone, the surviving %3A/%2C/%22 break JSON.parse and the
 * user sees a useless "Invalid blueprint" error.
 *
 * The fallback only kicks in when `decodeURI` produces something
 * `JSON.parse` rejects, so existing URLs keep their exact old semantics.
 *
 * Both decoders can throw `URIError` on malformed `%XX`; in that case we
 * return the best decoded string we have (or the raw hash) and let the
 * downstream JSON parser produce a descriptive error message.
 *
 * Lives in its own file (no side-effecting imports) so it can be unit
 * tested under any environment without booting the whole app.
 *
 * NOTE: a near-identical copy lives at
 * `packages/playground/personal-wp/src/lib/state/url/decode-blueprint-hash.ts`.
 * Keep them in sync.
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
