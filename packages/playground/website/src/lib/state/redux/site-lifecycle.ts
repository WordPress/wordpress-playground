import type { SiteInfo } from './slice-sites';

export const MAX_AUTOSAVED_SITES = 5;
export const RECENT_AUTOSAVE_RESTORE_WINDOW_MS = 15 * 60 * 1000;

export const SitePersistenceTypes = ['autosave', 'explicit'] as const;
export type SitePersistence = (typeof SitePersistenceTypes)[number];

export type AutosavedSitesPruneOptions = {
	limit?: number;
	excludeSlugs?: string[];
};

export function getSiteRecencyTimestamp(site: SiteInfo) {
	return site.metadata.whenLastUsed ?? site.metadata.whenCreated ?? 0;
}

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

export function isAutosavedSite(site: SiteInfo) {
	return (
		site.metadata.storage === 'opfs' &&
		site.metadata.persistence === 'autosave'
	);
}

export function isExplicitlySavedSite(site: SiteInfo) {
	return site.metadata.storage !== 'none' && !isAutosavedSite(site);
}

export function getAutosavedSitesToPrune(
	sites: SiteInfo[],
	{
		limit = MAX_AUTOSAVED_SITES,
		excludeSlugs = [],
	}: AutosavedSitesPruneOptions = {}
) {
	const excluded = new Set(excludeSlugs);
	const autosavedSites = sites
		.filter(isAutosavedSite)
		.sort(
			(a, b) => getSiteRecencyTimestamp(b) - getSiteRecencyTimestamp(a)
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
