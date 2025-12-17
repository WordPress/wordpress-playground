import type { SiteInfo } from '../redux/slice-sites';
import { updateUrl } from './router-hooks';
import { decodeBase64ToString } from '../../base64';

export function redirectTo(url: string) {
	window.history.pushState({}, '', url);
}

interface QueryAPIParams {
	name?: string;
	wp?: string;
	php?: string;
	language?: string;
	multisite?: 'yes' | 'no';
	networking?: 'yes' | 'no';
	/** Prefer OPFS-backed autosaved temporary sites when available. */
	'site-autosave'?: 'yes' | 'no';
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
	static site(
		site: SiteInfo,
		baseUrl: string = window.location.href,
		options: {
			/**
			 * Whether to include `site-slug` in the URL.
			 *
			 * - Stored sites always include it.
			 * - Autosaved temporary sites include it only when explicitly opened
			 *   from the Site Manager (or when already in `site-slug` mode).
			 * - In-memory temporary sites never include it.
			 */
			includeSiteSlug?: boolean;
		} = {}
	) {
		const baseParams = new URLSearchParams(baseUrl.split('?')[1]);
		const baseHasSiteSlug = baseParams.has('site-slug');
		const isInMemoryTemporary = site.metadata.storage === 'none';
		const isAutosavedTemporary = site.metadata.kind === 'autosave';

		const includeSiteSlug =
			options.includeSiteSlug ??
			(!isInMemoryTemporary &&
				(!isAutosavedTemporary || baseHasSiteSlug));

		if (!includeSiteSlug) {
			if (site.originalUrlParams) {
				return updateUrl(baseUrl, site.originalUrlParams);
			}
			// If we don't have enough information to reconstruct the original
			// Query API URL, keep the current URL but ensure we don't keep a
			// stale `site-slug` parameter.
			if (baseHasSiteSlug) {
				return updateUrl(
					baseUrl,
					{ searchParams: { 'site-slug': undefined } },
					'merge'
				);
			}
			return baseUrl;
		}

		const preserveParamsKeys = [
			'mode',
			'networking',
			'login',
			'url',
			'site-autosave',
		];
		const preserveParams: Record<string, string> = {};
		for (const param of preserveParamsKeys) {
			const value = baseParams.get(param);
			if (value !== null) {
				preserveParams[param] = value;
			}
		}
		return updateUrl(baseUrl, {
			searchParams: { 'site-slug': site.slug, ...preserveParams },
			hash: '',
		});
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
		// Preserve query flags that affect how the site is created (but are not
		// part of the Blueprint / runtime configuration).
		const baseParams = new URLSearchParams(baseUrl.split('?')[1]);
		if (!('site-autosave' in query) && baseParams.has('site-autosave')) {
			query['site-autosave'] =
				baseParams.get('site-autosave') || undefined;
		}
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
