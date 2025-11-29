import type { SiteInfo } from '../redux/slice-sites';
import type { SiteManagerSection } from '../redux/slice-ui';
import { updateUrl } from './router-hooks';
import { decodeBase64ToString } from '../../base64';

export function redirectTo(url: string) {
	window.history.pushState({}, '', url);
}

/**
 * Route state representation for UI navigation.
 */
export type RouteState = {
	sidebarOpen: boolean;
	section: SiteManagerSection;
	tab?: string;
};

const VALID_TABS = ['settings', 'files', 'blueprint', 'database', 'logs'];

/**
 * Parse the `route` query parameter into a RouteState object.
 *
 * Route format:
 * - "closed" or absent → sidebar closed
 * - "sidebar" → sidebar open, section='sidebar'
 * - "details" → sidebar open, section='site-details', tab='settings'
 * - "details.{tab}" → sidebar open, section='site-details', specific tab
 * - "blueprints" → sidebar open, section='blueprints'
 */
export function parseRouteParam(route: string | null): RouteState {
	if (!route || route === 'closed') {
		return { sidebarOpen: false, section: 'site-details' };
	}

	if (route === 'sidebar') {
		return { sidebarOpen: true, section: 'sidebar' };
	}

	if (route === 'blueprints') {
		return { sidebarOpen: true, section: 'blueprints' };
	}

	if (route === 'details') {
		return { sidebarOpen: true, section: 'site-details', tab: 'settings' };
	}

	if (route.startsWith('details.')) {
		const tab = route.substring('details.'.length);
		if (VALID_TABS.includes(tab)) {
			return { sidebarOpen: true, section: 'site-details', tab };
		}
		// Invalid tab, fall back to settings
		return { sidebarOpen: true, section: 'site-details', tab: 'settings' };
	}

	// Unknown route, default to closed
	return { sidebarOpen: false, section: 'site-details' };
}

/**
 * Build a route parameter string from a RouteState object.
 * Returns 'closed' if the sidebar is closed.
 */
export function buildRouteParam(state: RouteState): string {
	if (!state.sidebarOpen) {
		return 'closed';
	}

	if (state.section === 'sidebar') {
		return 'sidebar';
	}

	if (state.section === 'blueprints') {
		return 'blueprints';
	}

	// section === 'site-details'
	if (state.tab && state.tab !== 'settings') {
		return `details.${state.tab}`;
	}

	return 'details';
}

/**
 * Update the route query parameter in the current URL using replaceState.
 */
export function updateRouteInUrl(state: RouteState): void {
	const url = new URL(window.location.href);
	const routeValue = buildRouteParam(state);
	url.searchParams.set('route', routeValue);
	window.history.replaceState({}, '', url.href);
}

interface QueryAPIParams {
	name?: string;
	wp?: string;
	php?: string;
	language?: string;
	multisite?: 'yes' | 'no';
	networking?: 'yes' | 'no';
	theme?: string[];
	login?: 'yes' | 'no';
	plugin?: string[];
	blueprint?: string;
	'import-site'?: string;
	'import-wxr'?: string;
	'import-content'?: string;
	url?: string;
	'blueprint-url'?: string;
}

export function parseBlueprint(rawData: string) {
	try {
		try {
			return JSON.parse(rawData);
		} catch {
			return JSON.parse(decodeBase64ToString(rawData));
		}
	} catch {
		throw new Error('Invalid blueprint');
	}
}

export class PlaygroundRoute {
	static site(site: SiteInfo, baseUrl: string = window.location.href) {
		if (site.metadata.storage === 'none') {
			return updateUrl(baseUrl, site.originalUrlParams || {});
		} else {
			const baseParams = new URLSearchParams(baseUrl.split('?')[1]);
			// Preserve UI-related params and display mode params when switching sites
			const preserveParamsKeys = [
				'mode',
				'networking',
				'login',
				'url',
				'route',
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
	static newTemporarySite(
		config: {
			query?: QueryAPIParams;
			hash?: string;
		} = {},
		baseUrl: string = window.location.href
	) {
		const query =
			(config.query as Record<string, string | undefined>) || {};
		return updateUrl(
			baseUrl,
			{
				searchParams: {
					...query,
					// Ensure a part of the URL is unique so we can still
					// reload the temporary site even if its configuration
					// hasn't changed.
					random: Math.random().toString(36).substring(2, 15),
				},
				hash: config.hash,
			},
			'replace'
		);
	}
}
