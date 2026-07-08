import type { SiteInfo } from './slice-sites';

/**
 * Keep a small recovery history without letting invisible autosaves grow OPFS
 * usage forever. UI that surfaces autosaves should use this same limit so
 * users can see every autosave retained by pruning.
 */
export const MAX_AUTOSAVED_SITES = 5;

/**
 * Only prompt to restore autosaves from a recently interrupted session. Older
 * autosaves remain recoverable from the Playgrounds overlay instead.
 */
export const RECENT_AUTOSAVE_RESTORE_WINDOW_MS = 15 * 60 * 1000;

/**
 * Persistence states for stored Playgrounds.
 */
export const SitePersistenceTypes = ['autosave', 'explicit'] as const;
export type SitePersistence = (typeof SitePersistenceTypes)[number];

export type AutosavedSitesPruneOptions = {
	/**
	 * Maximum number of autosaved sites to retain.
	 */
	limit?: number;
	/**
	 * Site slugs to keep even when they would otherwise be pruned.
	 */
	excludeSlugs?: string[];
};

/**
 * Returns the timestamp used to sort sites by recency.
 */
export function getSiteRecencyTimestamp(site: SiteInfo) {
	return site.metadata.whenLastUsed ?? site.metadata.whenCreated ?? 0;
}

/**
 * Returns sites sorted by recency without mutating the input array.
 */
export function getSitesSortedByRecency(sites: readonly SiteInfo[]) {
	return [...sites].sort(
		(a, b) => getSiteRecencyTimestamp(b) - getSiteRecencyTimestamp(a)
	);
}

/**
 * Indicates whether a site was used within the recent-autosave window.
 */
export function wasSiteRecentlyInteractedWith(
	site: SiteInfo,
	now = Date.now()
) {
	const recencyTimestamp = getSiteRecencyTimestamp(site);
	return (
		recencyTimestamp > 0 &&
		now - recencyTimestamp <= RECENT_AUTOSAVE_RESTORE_WINDOW_MS
	);
}

/**
 * Indicates whether a site is an automatic browser-storage recovery copy.
 */
export function isAutosavedSite(site: SiteInfo) {
	return (
		site.metadata.storage === 'opfs' &&
		site.metadata.persistence === 'autosave'
	);
}

/**
 * Indicates whether a site should be treated as explicitly saved.
 */
export function isExplicitlySavedSite(site: SiteInfo) {
	return site.metadata.storage !== 'none' && !isAutosavedSite(site);
}

/**
 * Returns the persistence value exposed by the public site-management API.
 *
 * Persistence describes a stored Playground, so temporary Playgrounds do not
 * report a value here.
 */
export function getSitePublicPersistence(site: SiteInfo) {
	if (site.metadata.storage === 'none') {
		return undefined;
	}
	return isAutosavedSite(site) ? 'autosave' : 'explicit';
}

/**
 * Returns autosaved sites to delete after honoring the retention limit.
 */
export function getAutosavedSitesToPrune(
	sites: readonly SiteInfo[],
	{
		limit = MAX_AUTOSAVED_SITES,
		excludeSlugs = [],
	}: AutosavedSitesPruneOptions = {}
) {
	const excluded = new Set(excludeSlugs);
	const autosavedSites = getSitesSortedByRecency(
		sites.filter(isAutosavedSite)
	);
	const retainedSlugs = new Set(
		autosavedSites
			.filter((site) => excluded.has(site.slug))
			.map((site) => site.slug)
	);
	for (const site of autosavedSites) {
		if (retainedSlugs.size < limit) {
			retainedSlugs.add(site.slug);
		}
	}
	return autosavedSites.filter((site) => !retainedSlugs.has(site.slug));
}
