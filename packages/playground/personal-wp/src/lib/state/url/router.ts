import type { SiteInfo } from '../redux/slice-sites';
import { updateUrl } from './router-hooks';
import { personalWPSiteSlug } from 'virtual:website-defaults';
import { isAppBasePath } from './app-base-url';
import { HEALTH_CHECK_RECOVERY_MODE_QUERY_PARAM } from '../../health-check-recovery';

export function redirectTo(url: string) {
	window.history.pushState({}, '', url);
}

/**
 * Playground-specific query keys that should be removed from the URL
 * once they've been consumed by the boot pipeline. Anything outside
 * this list (e.g. WordPress query vars or plugin-specific params) is
 * left in place so the URL remains bookmarkable.
 */
export const PLAYGROUND_QUERY_KEYS = [
	'site-slug',
	'mode',
	'name',
	'wp',
	'php',
	'language',
	'multisite',
	'networking',
	'theme',
	'login',
	'plugin',
	'url',
	'blueprint-url',
	'blueprint',
	'import-site',
	'import-wxr',
	'import-content',
	'page-title',
	HEALTH_CHECK_RECOVERY_MODE_QUERY_PARAM,
];

export class PlaygroundRoute {
	static site(site: SiteInfo, baseUrl: string = window.location.href) {
		if (site.metadata.storage === 'none') {
			return updateUrl(baseUrl, site.originalUrlParams || {});
		} else {
			// If this is the default site, don't add site-slug to the URL
			if (personalWPSiteSlug && site.slug === personalWPSiteSlug) {
				// Strip Playground-specific query params, but keep
				// anything else (e.g. WordPress query vars like
				// ?p=42 or plugin-specific params like ?app-store=1)
				// so the URL remains bookmarkable.
				const url = new URL(baseUrl, window.location.href);
				if (isAppBasePath(url.pathname)) {
					for (const key of PLAYGROUND_QUERY_KEYS) {
						url.searchParams.delete(key);
					}
				}
				url.hash = '';
				return url.toString();
			}
			const url = new URL(baseUrl, window.location.href);
			if (!isAppBasePath(url.pathname)) {
				return updateUrl(
					url.toString(),
					{
						searchParams: { 'site-slug': site.slug },
						hash: '',
					},
					'merge'
				);
			}
			const baseParams = url.searchParams;
			const preserveParamsKeys = [
				'mode',
				'networking',
				'login',
				'page-title',
			];
			const preserveParams: Record<string, string | null> = {};
			for (const param of preserveParamsKeys) {
				if (baseParams.has(param)) {
					preserveParams[param] = baseParams.get(param);
				}
			}
			return updateUrl(baseUrl, {
				searchParams: { 'site-slug': site.slug, ...preserveParams },
				hash: '',
			});
		}
	}
}
