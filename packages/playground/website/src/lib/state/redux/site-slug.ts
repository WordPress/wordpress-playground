export function normalizeSiteSlug(slug: string) {
	return (
		slug
			.toLowerCase()
			.trim()
			.replaceAll(/\s+/g, '-')
			.replaceAll(/[^a-z0-9_-]/g, '-')
			.replaceAll(/-+/g, '-')
			.replaceAll(/^-|-$/g, '') || 'playground'
	);
}

export function getUniqueSiteSlug(
	preferredSlug: string,
	unavailableSlugs: Iterable<string>
) {
	const unavailable = new Set(unavailableSlugs);
	const baseSlug = normalizeSiteSlug(preferredSlug);
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
