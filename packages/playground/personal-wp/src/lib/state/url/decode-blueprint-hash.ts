/**
 * Twin of
 * `packages/playground/website/src/lib/state/url/decode-blueprint-hash.ts`.
 * See that file for full documentation. Keep these two in sync.
 */
export function decodeBlueprintHash(rawHash: string): string {
	const stripped = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;

	let decodedURI: string | undefined;
	try {
		decodedURI = decodeURI(stripped);
		JSON.parse(decodedURI);
		return decodedURI;
	} catch {
		// fall through
	}

	try {
		return decodeURIComponent(stripped);
	} catch {
		return decodedURI ?? stripped;
	}
}
