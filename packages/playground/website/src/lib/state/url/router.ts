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
			const preserveParamsKeys = [
				'mode',
				'networking',
				'login',
				'url',
				'page-title',
				'mcp',
				'mcp-port',
				'can-save',
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

/**
 * Checks if the URL has a query parameter that disables saving.
 *
 * @returns {boolean} True if saving is disabled by the query parameter, false otherwise.
 */
export function isSaveDisabledByQueryParam(): boolean {
	return (
		new URL(document.location.href).searchParams.get('can-save') === 'no'
	);
}

/**
 * Checks if the MCP server bridge is enabled via the `?mcp=yes` query parameter.
 */
export function isMcpServerEnabled(): boolean {
	return new URL(document.location.href).searchParams.get('mcp') === 'yes';
}
