import { cleanForSlug } from '@wordpress/url';

/**
 * Builds the readable slug prefix used when a caller did not provide a hint.
 *
 * For example, "My Playground" becomes "my-playground". This is not the final
 * routing address: getUniqueSiteSlug() adds the random suffix when allocating it.
 * Explicit slug hints bypass this helper so their URL/storage escaping remains
 * the responsibility of the boundaries that consume them.
 */
export function deriveSlugFromSiteName(name: string) {
	return cleanForSlug(name) || 'playground';
}

/**
 * Adds a cryptographically random UUID to every new site slug.
 *
 * For example, the hint "demo" becomes `demo-<UUID>`, even if "demo" is unused.
 * The website also uses this slug as the running site's HTTP scope. A plugin on
 * the shared WordPress origin must not be able to guess another site's address
 * from its name or from a sequence such as demo, demo-2, demo-3.
 *
 * Callers decide whether the prefix comes from a display name or an explicit
 * hint; both receive the same 122 random bits. Preserve explicit hint bytes and
 * use "playground" for an empty prefix. If a candidate is unavailable, generate
 * another UUID rather than falling back to a predictable numeric suffix.
 *
 * This allocates new sites only. Existing stored slugs remain unchanged so old
 * links and OPFS paths still work. Callers must use the returned slug, not assume
 * the preferred hint was accepted as the final address. Randomness makes guessing
 * difficult; it does not deny HTTP requests from a page that learns the scope.
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
