import { type ResolvedBlueprint } from '../state/url/resolve-blueprint-from-url';

/**
 * Determines whether to use the default persistent blueprint or process URL params.
 *
 * Persistent sites support two modes:
 * 1. Clean URL (no params): Use the default persistent blueprint for initial setup
 * 2. URL with params (e.g., ?plugin=friends): Apply the blueprint from URL params
 *
 * This allows users to customize their persistent site by visiting URLs like:
 * - playground.wordpress.net/?plugin=woocommerce
 * - playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint.json
 *
 * Returns true (use default blueprint) when:
 * - We're in the top window (not embedded in an iframe)
 * - No URL query params or hash fragment present
 * - A local default blueprint URL is configured (starts with '/')
 */
export function shouldUsePersistentBlueprint(
	url: URL,
	defaultBlueprintUrl?: string
): boolean {
	const hasUrlParams = url.searchParams.size > 0;
	const hasHashFragment = url.hash.length > 1; // More than just '#'
	const hasLocalDefaultBlueprint = defaultBlueprintUrl?.startsWith('/');
	const isTopWindow = window.self === window.top;

	return (
		isTopWindow &&
		!hasUrlParams &&
		!hasHashFragment &&
		!!hasLocalDefaultBlueprint
	);
}

/**
 * Loads the persistent blueprint from a URL.
 */
export async function loadPersistentBlueprint(
	blueprintUrl: string
): Promise<ResolvedBlueprint> {
	const response = await fetch(blueprintUrl);
	const blueprint = await response.json();

	return {
		blueprint,
		source: {
			type: 'persistent-blueprint',
			url: blueprintUrl,
		},
	};
}
