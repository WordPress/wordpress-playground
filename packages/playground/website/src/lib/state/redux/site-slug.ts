import { cleanForSlug } from '@wordpress/url';

/**
 * Builds the readable slug prefix used when a caller did not provide a hint.
 *
 * Explicit slug hints bypass this helper so their URL/storage escaping remains
 * the responsibility of the boundaries that consume them.
 */
export function deriveSlugFromSiteName(name: string) {
	return cleanForSlug(name) || 'playground';
}

/**
 * Adds a cryptographically random UUID to every new site slug.
 *
 * Names and explicit hints are readable prefixes, not predictable addresses.
 * Existing stored slugs are left alone so old links and OPFS paths still work.
 *
 * Callers decide whether the preferred slug comes from user-facing text or an
 * explicit slug hint. Both paths receive the same 122 random bits.
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
	let candidate: string;
	do {
		candidate = `${baseSlug}-${crypto.randomUUID()}`;
	} while (unavailable.has(candidate));
	return candidate;
}
