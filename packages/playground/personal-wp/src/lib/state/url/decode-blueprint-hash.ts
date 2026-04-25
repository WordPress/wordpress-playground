/**
 * Twin of decode-blueprint-hash.ts in packages/playground/website.
 * See that file for the rationale; keep these two in sync.
 */
export function decodeBlueprintHash(rawHash: string): string {
	const stripped = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;

	let decodedComponent: string | undefined;
	try {
		decodedComponent = decodeURIComponent(stripped);
		JSON.parse(decodedComponent);
		return decodedComponent;
	} catch {
		// fall through
	}

	try {
		return decodeURI(stripped);
	} catch {
		return decodedComponent ?? stripped;
	}
}
