import type { BlueprintSource } from '../state/url/resolve-blueprint-from-url';

/**
 * URL prefixes that are considered trusted and bypass confirmation.
 *
 * - Official WordPress blueprints repo
 * - WordPress.org plugin API
 *
 * Note: data:application/json;base64, URLs are NOT trusted as they can contain
 * arbitrary blueprint content, similar to inline hash fragments.
 */
const TRUSTED_URL_PREFIXES = [
	'https://raw.githubusercontent.com/WordPress/blueprints/',
	'https://wordpress.org/plugins/wp-json/plugins/v1/plugin',
];

/**
 * Check if a blueprint source is trusted and should bypass confirmation.
 *
 * Trusted sources include:
 * - `type: 'none'` - Query param blueprints like `?plugin=friends` (resolves to wordpress.org)
 * - Remote URLs from trusted prefixes (official blueprints repo, wordpress.org)
 *
 * NOT trusted (requires confirmation):
 * - data: URLs (can contain arbitrary content, like inline hash fragments)
 * - Any other external URLs
 *
 * @param source - The blueprint source to check
 * @returns true if the source is trusted
 */
export function isTrustedSource(source: BlueprintSource): boolean {
	if (source.type === 'none') {
		return true;
	}

	if (source.type === 'remote-url' || source.type === 'personal-blueprint') {
		return TRUSTED_URL_PREFIXES.some((prefix) =>
			source.url.startsWith(prefix)
		);
	}

	return false;
}
