import type { SiteInfo } from '../redux/slice-sites';

/**
 * URL parameters that do not affect site identity. These are stripped
 * before comparing URL params so that cosmetic or session-level
 * differences don't create separate persisted sites. Any param not
 * in this set is considered identity-affecting and will be included
 * in the comparison.
 */
const STRIPPED_PARAMS = new Set([
	'random',
	'modal',
	'site-slug',
	'mode',
	'login',
	'url',
	'page-title',
	'networking',
	'name',
	'experimental-blueprints-v2-runner',
	'progressbar',
]);

type UrlParams = {
	searchParams?: Record<string, string | string[]>;
	hash?: string;
};

/**
 * Keeps only identity-affecting params, sorts keys, and normalizes
 * the hash. Returns a canonical representation suitable for comparison.
 */
export function normalizeUrlParamsForIdentity(
	params: UrlParams
): { searchParams: Record<string, string | string[]>; hash: string } {
	const normalized: Record<string, string | string[]> = {};

	if (params.searchParams) {
		// Keep only params that affect site identity (i.e. not in the
		// stripped set). Unknown params are kept since they likely come
		// from blueprints and matter for identity.
		const keys = Object.keys(params.searchParams).sort();
		for (const key of keys) {
			if (STRIPPED_PARAMS.has(key)) {
				continue;
			}
			const value = params.searchParams[key];
			if (value !== undefined && value !== '') {
				normalized[key] = value;
			}
		}
	}

	// Normalize hash: strip leading '#', treat empty as ''
	let hash = params.hash || '';
	if (hash.startsWith('#')) {
		hash = hash.slice(1);
	}

	return { searchParams: normalized, hash };
}

/**
 * Returns true when two sets of URL params represent the same
 * site identity (same blueprint configuration).
 */
export function urlParamsMatch(a: UrlParams, b: UrlParams): boolean {
	const normA = normalizeUrlParamsForIdentity(a);
	const normB = normalizeUrlParamsForIdentity(b);
	return JSON.stringify(normA) === JSON.stringify(normB);
}

/**
 * Searches a list of sites for one whose `originalUrlParams` match the
 * given URL params. Returns the first match, or undefined.
 */
export function findSiteMatchingUrlParams(
	sites: SiteInfo[],
	urlParams: UrlParams
): SiteInfo | undefined {
	return sites.find(
		(site) =>
			site.originalUrlParams &&
			urlParamsMatch(site.originalUrlParams, urlParams)
	);
}
