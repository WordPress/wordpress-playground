import { Blueprint } from '@wp-playground/blueprints';
import { makeBlueprint } from './make-blueprint';
import { type SiteInfo } from './site-storage';

const defaultPhpVersion = '8.0';

/**
 * Get a URL with query params representing the specified site settings.
 *
 * @param baseUrl The current Playground URL
 * @param siteInfo The site info to convert to Playground query params
 * @returns URL with query params representing the site info
 */
export function siteInfoToUrl(baseUrl: URL, siteInfo: SiteInfo): URL {
	const newUrl = new URL(baseUrl);
	newUrl.search = '';

	const query = newUrl.searchParams;
	query.set('php', siteInfo.phpVersion || defaultPhpVersion);
	query.set('wp', siteInfo.wpVersion || 'latest');
	query.set('site-slug', siteInfo.slug);

	const preservedQueryParams = ['language', 'networking', 'storage'];
	for (const key of preservedQueryParams) {
		if (baseUrl.searchParams.has(key)) {
			query.set(key, baseUrl.searchParams.get(key)!);
		}
	}

	// TODO as playgroundFeatures
	// if (blueprint.features?.networking) {
	// 	query.set('networking', 'yes');
	// }

	// TODO
	// if (blueprint.language) {
	// 	query.set('language', blueprint.language);
	// }

	// TODO
	// if (blueprint.theme) {
	// 	query.set('theme', blueprint.theme);
	// }

	// TODO
	// query.set('login', blueprint.login ? 'yes' : 'no');
	// query.set('multisite', blueprint.multisite ? 'yes' : 'no');

	// TODO
	// if (blueprint.plugins && blueprint.plugins.length > 0) {
	// 	blueprint.plugins.forEach(plugin => query.append('plugin', plugin));
	//}

	// TODO
	// if (blueprint.landingPage) {
	// 	query.set('url', blueprint.landingPage);
	// }

	// TODO as playgroundFeatures
	// if (blueprint.phpExtensionBundles && blueprint.phpExtensionBundles.length > 0) {
	// 	blueprint.phpExtensionBundles.forEach(bundle => query.append('php-extension-bundle', bundle));
	// }

	// TODO: Maybe
	// if (blueprint.importSite) {
	// 	query.set('import-site', blueprint.importSite);
	// }

	// TODO: Maybe
	// if (blueprint.importWxr) {
	// 	query.set('import-wxr', blueprint.importWxr);
	// }

	return newUrl;
}

/**
 * Create a Blueprint based on Playground query params.
 *
 * @param query Query params to convert to a Blueprint
 * @returns A Blueprint reflecting the settings specified by query params
 */
export function queryParamsToBlueprint(query: URLSearchParams): Blueprint {
	const features: Blueprint['features'] = {};

	/**
	 * Networking is disabled by default, so we only need to enable it
	 * if the query param is explicitly set to "yes".
	 */
	if (query.get('networking') === 'yes') {
		features['networking'] = true;
	}
	const blueprint = makeBlueprint({
		php: query.get('php') || defaultPhpVersion,
		wp: query.get('wp') || 'latest',
		theme: query.get('theme') || undefined,
		login: !query.has('login') || query.get('login') === 'yes',
		multisite: query.get('multisite') === 'yes',
		features,
		plugins: query.getAll('plugin'),
		landingPage: query.get('url') || undefined,
		phpExtensionBundles: query.getAll('php-extension-bundle') || [],
		importSite: query.get('import-site') || undefined,
		importWxr:
			query.get('import-wxr') || query.get('import-content') || undefined,
		language: query.get('language') || undefined,
	});

	return blueprint;
}
