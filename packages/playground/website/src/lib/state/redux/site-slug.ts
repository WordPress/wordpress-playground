/**
 * Generates a site slug independently of its human-readable display name.
 * Twelve random letters from a 25-letter alphabet provide about 55.7 bits of entropy.
 * Omit "l" to avoid confusing it with "i".
 *
 * Explicit slug hints bypass this helper so their URL/storage escaping remains
 * the responsibility of the boundaries that consume them.
 */
export function generateSiteSlug() {
	const alphabet = 'abcdefghijkmnopqrstuvwxyz';
	let letters = '';
	while (letters.length < 12) {
		const bytes = crypto.getRandomValues(
			new Uint8Array(12 - letters.length)
		);
		for (const byte of bytes) {
			// 250 is divisible by 25. Reject the remaining bytes so each letter
			// has the same chance instead of favoring the first six letters.
			if (byte < 250) {
				letters += alphabet[byte % alphabet.length];
			}
		}
	}
	return `${letters.slice(0, 4)}-${letters.slice(4, 8)}-${letters.slice(8)}`;
}

/**
 * Returns a preferred site slug with a numeric suffix when needed.
 *
 * Callers supply either a generated slug or an explicit slug hint.
 * This function only handles empty strings and collisions.
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
