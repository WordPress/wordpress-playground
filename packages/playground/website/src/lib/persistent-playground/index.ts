import { type ResolvedBlueprint } from '../state/url/resolve-blueprint-from-url';

/**
 * Checks if this URL should use the persistent blueprint path.
 * Returns true when:
 * - We're in the top window (not embedded)
 * - No URL query params or hash fragment
 * - defaultBlueprintUrl is a local path (starts with '/')
 */
export function shouldUsePersistentBlueprint(
	url: URL,
	defaultBlueprintUrl?: string
): boolean {
	const query = url.searchParams;
	const fragment = (url.hash || '#').substring(1);

	return (
		window.self === window.top &&
		!query.size &&
		!fragment.length &&
		!!defaultBlueprintUrl?.startsWith('/')
	);
}

/**
 * Loads the persistent blueprint.
 * - Fetches the blueprint JSON
 * - Resolves relative URLs to absolute URLs
 */
export async function loadPersistentBlueprint(
	blueprintUrl: string
): Promise<ResolvedBlueprint> {
	const response = await fetch(blueprintUrl);
	const blueprint = await response.json();

	const absoluteUrl = new URL(blueprintUrl, window.location.origin).href;
	resolveRelativeUrls(blueprint, absoluteUrl);

	return {
		blueprint,
		source: {
			type: 'persistent-blueprint',
			url: blueprintUrl,
		},
	};
}

/**
 * Recursively resolves relative URLs in a blueprint object.
 * Finds all { resource: "url", url: "./..." } and converts to absolute URLs.
 */
function resolveRelativeUrls(obj: unknown, baseUrl: string): void {
	if (!obj || typeof obj !== 'object') {
		return;
	}

	if (Array.isArray(obj)) {
		for (const item of obj) {
			resolveRelativeUrls(item, baseUrl);
		}
		return;
	}

	const record = obj as Record<string, unknown>;
	if (
		record.resource === 'url' &&
		typeof record.url === 'string' &&
		(record.url.startsWith('./') || record.url.startsWith('../'))
	) {
		record.url = new URL(record.url, baseUrl).href;
	}

	for (const key of Object.keys(record)) {
		resolveRelativeUrls(record[key], baseUrl);
	}
}
