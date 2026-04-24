/**
 * Twin of decode-blueprint-hash.ts in packages/playground/website.
 * See that file for the rationale; keep these two in sync.
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
