import { Blueprint } from '@wp-playground/blueprints';
import { SiteInfo } from '../redux/slice-sites';
import { updateUrl } from './router-hooks';
import { encodeStringAsBase64 } from '../../base64';

export function redirectTo(url: string) {
	window.history.pushState({}, '', url);
}

interface QueryAPIParams {
	name?: string;
	wp?: string;
	php?: string;
	'php-extension-bundle'?: 'light' | 'kitchen-sink';
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
		} catch (e) {
			return JSON.parse(encodeStringAsBase64(rawData));
		}
	} catch (e) {
		throw new Error('Invalid blueprint');
	}
}

export class PlaygroundRoute {
	static site(site: SiteInfo, baseUrl: string = window.location.href) {
		if (site.metadata.storage === 'none') {
			return updateUrl(baseUrl, site.originalUrlParams || {});
		} else {
			return updateUrl(baseUrl, {
				searchParams: { 'site-slug': site.slug },
			});
		}
	}
	static newTemporarySite(
		config?: {
			query?: QueryAPIParams;
			blueprint?: Blueprint;
		},
		baseUrl: string = window.location.href
	) {
		if (!config) {
			return updateUrl(
				baseUrl,
				{
					searchParams: { 'site-slug': undefined },
				},
				'merge'
			);
		}
		const { query, blueprint } = config;
		return updateUrl(
			baseUrl,
			{
				searchParams:
					(query as Record<string, string | undefined>) || {},
				hash: blueprint
					? '#' + encodeStringAsBase64(JSON.stringify(blueprint))
					: undefined,
			},
			'replace'
		);
	}
}
