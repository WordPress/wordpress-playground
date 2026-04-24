import type { SiteInfo } from '../redux/slice-sites';
import { updateUrl } from './router-hooks';
import { decodeBase64ToString } from '../../base64';
import { personalWPSiteSlug } from 'virtual:website-defaults';

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
	theme?: string[];
	login?: 'yes' | 'no';
	plugin?: string[];
	blueprint?: string;
	'import-site'?: string;
	'import-wxr'?: string;
	'import-content'?: string;
	url?: string;
	'blueprint-url'?: string;
	'page-title'?: string;
}

/**
 * Parses a blueprint string into a blueprint object. Accepts plain
 * JSON or base64-encoded JSON. On failure, throws an `Error` whose
 * message includes the underlying JSON parse error and, when `%XX`
 * escapes are still present, a hint that the URL fragment may have
 * been double-encoded.
 */
export function parseBlueprint(rawData: string) {
	const errors: unknown[] = [];
	try {
		return JSON.parse(rawData);
	} catch (e) {
		errors.push(e);
	}
	try {
		return JSON.parse(decodeBase64ToString(rawData));
	} catch (e) {
		errors.push(e);
	}
	throw new Error(formatInvalidBlueprintError(rawData, errors));
}

function formatInvalidBlueprintError(rawData: string, errors: unknown[]): string {
	const looksLikeBase64 = /^[A-Za-z0-9+/=]+$/.test(rawData.trim());
	// Prefer the base64-decode-then-parse error if the input looks
	// base64-shaped; otherwise the plain JSON.parse error is the more
	// useful signal.
	const primary = looksLikeBase64 && errors[1] ? errors[1] : errors[0];
	const detail =
		primary instanceof Error ? primary.message : String(primary ?? '');
	const sentences = ['Invalid blueprint'];
	if (detail) {
		sentences.push(detail);
	}
	if (/%[0-9A-Fa-f]{2}/.test(rawData)) {
		sentences.push(
			'The input still contains %XX escapes after decoding, so the URL fragment may have been double-encoded'
		);
	}
	return sentences.join('. ') + '.';
}

export class PlaygroundRoute {
	static site(site: SiteInfo, baseUrl: string = window.location.href) {
		if (site.metadata.storage === 'none') {
			return updateUrl(baseUrl, site.originalUrlParams || {});
		} else {
			// If this is the default site, don't add site-slug to the URL
			if (personalWPSiteSlug && site.slug === personalWPSiteSlug) {
				// Preserve blueprint-url and url parameters if present
				const baseParams = new URLSearchParams(baseUrl.split('?')[1]);
				const preserveParamsKeys = ['blueprint-url', 'url'];
				const preserveParams: Record<string, string> = {};
				for (const param of preserveParamsKeys) {
					const value = baseParams.get(param);
					if (value !== null) {
						preserveParams[param] = value;
					}
				}
				return updateUrl(baseUrl, {
					searchParams: preserveParams,
					hash: '',
				});
			}
			const baseParams = new URLSearchParams(baseUrl.split('?')[1]);
			const preserveParamsKeys = [
				'mode',
				'networking',
				'login',
				'url',
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
