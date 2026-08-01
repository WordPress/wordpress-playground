import { cleanForSlug } from '@wordpress/url';

/**
 * Builds the default site slug used when a caller did not provide one.
 *
 * Explicit slug hints bypass this helper so their URL/storage escaping remains
 * the responsibility of the boundaries that consume them.
 */
export function deriveSlugFromSiteName(name: string) {
	return cleanForSlug(name) || 'playground';
}

/**
 * Returns a preferred site slug with a numeric suffix when needed.
 *
 * Callers decide whether the preferred slug comes from user-facing text or an
 * explicit slug hint. This function only handles empty strings and collisions.
 */
export function getUniqueSiteSlug(
	preferredSlug: string,
	{
		unavailableSlugs,
	}: {
		unavailableSlugs: Iterable<string>;
	}
) {
	const unavailable = new Set(unavailableSlugs);
	const baseSlug = preferredSlug || 'playground';
	if (!unavailable.has(baseSlug)) {
		return baseSlug;
	}
	let suffix = 2;
	let candidate = `${baseSlug}-${suffix}`;
	while (unavailable.has(candidate)) {
		suffix++;
		candidate = `${baseSlug}-${suffix}`;
	}
	return candidate;
}
