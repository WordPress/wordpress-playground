import { Blueprint } from '@wp-playground/client';
import { parseBlueprint } from './router';

export async function resolveBlueprintFromURL(url: URL) {
	const query = url.searchParams;
	const fragment = decodeURI(url.hash || '#').substring(1);

	let blueprint: Blueprint;
	/*
	 * Support passing blueprints via query parameter, e.g.:
	 * ?blueprint-url=https://example.com/blueprint.json
	 */
	if (query.has('blueprint-url')) {
		const url = query.get('blueprint-url');
		const response = await fetch(url!, {
			credentials: 'omit',
		});
		blueprint = await response.json();
	} else if (fragment.length) {
		/*
		 * Support passing blueprints in the URI fragment, e.g.:
		 * /#{"landingPage": "/?p=4"}
		 */
		blueprint = parseBlueprint(fragment);
	} else {
		const importWxrQueryArg =
			query.get('import-wxr') || query.get('import-content');

		// This Blueprint is intentionally missing most query args (like login).
		// They are added below to ensure they're also applied to Blueprints passed
		// via the hash fragment (#{...}) or via the `blueprint-url` query param.
		blueprint = {
			plugins: query.getAll('plugin'),
			steps: [
				importWxrQueryArg &&
					/^(http(s?)):\/\//i.test(importWxrQueryArg) && {
						step: 'importWxr',
						file: {
							resource: 'url',
							url: importWxrQueryArg,
						},
					},
				query.get('import-site') &&
					/^(http(s?)):\/\//i.test(query.get('import-site')!) && {
						step: 'importWordPressFiles',
						wordPressFilesZip: {
							resource: 'url',
							url: query.get('import-site')!,
						},
					},
				query.get('theme') && {
					step: 'installTheme',
					themeZipFile: {
						resource: 'wordpress.org/themes',
						slug: query.get('theme')!,
					},
					progress: { weight: 2 },
				},
			],
		};
	}

	/**
	 * Allow overriding PHP and WordPress versions defined in a Blueprint
	 * via query params.
	 */

	// PHP and WordPress versions
	if (!blueprint.preferredVersions) {
		blueprint.preferredVersions = {} as any;
	}
	blueprint.preferredVersions!.php =
		(query.get('php') as any) || blueprint.preferredVersions!.php || '8.0';
	blueprint.preferredVersions!.wp =
		query.get('wp') || blueprint.preferredVersions!.wp || 'latest';

	// Features
	if (query.has('features')) {
		if (!blueprint.features) {
			blueprint.features = {};
		}

		/**
		 * Networking is disabled by default, so we only need to enable it
		 * if the query param is explicitly set to "yes".
		 */
		if (query.get('networking') === 'yes') {
			blueprint.features['networking'] = true;
		}
	}

	// PHP extension bundle
	if (query.has('php-extension-bundle')) {
		blueprint.phpExtensionBundles = query.getAll(
			'php-extension-bundle'
		) as any[];
	}

	// Language
	if (query.get('language')) {
		if (
			!blueprint?.steps?.find(
				(step) => step && (step as any).step === 'setSiteLanguage'
			)
		) {
			blueprint.steps?.push({
				step: 'setSiteLanguage',
				language: query.get('language')!,
			});
		}
	}

	// Multisite
	if (query.get('multisite') === 'yes') {
		if (
			!blueprint?.steps?.find(
				(step) => step && (step as any).step === 'enableMultisite'
			)
		) {
			blueprint.steps?.push({
				step: 'enableMultisite',
			});
		}
	}

	// Login
	if (query.get('login') !== 'no') {
		blueprint.login = true;
	}

	// Landing page
	if (query.get('url')) {
		blueprint.landingPage = query.get('url')!;
	}

	/*
	 * The 6.3 release includes a caching bug where
	 * registered styles aren't enqueued when they
	 * should be. This isn't present in all environments
	 * but it does here in the Playground. For now,
	 * the fix is to define `WP_DEVELOPMENT_MODE = all`
	 * to bypass the style cache.
	 *
	 * @see https://core.trac.wordpress.org/ticket/59056
	 */
	if (blueprint.preferredVersions?.wp === '6.3') {
		blueprint.steps?.unshift({
			step: 'defineWpConfigConsts',
			consts: {
				WP_DEVELOPMENT_MODE: 'all',
			},
		});
	}

	return blueprint;
}
