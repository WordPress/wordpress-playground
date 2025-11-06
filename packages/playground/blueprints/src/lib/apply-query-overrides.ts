import type { BlueprintV1Declaration } from './v1/types';
import type { BlueprintBundle } from './types';
import { getBlueprintDeclaration, isBlueprintBundle } from './v1/compile';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { OverlayFilesystem, InMemoryFilesystem } from '@wp-playground/storage';

/**
 * Apply query parameter overrides to a blueprint.
 *
 * This function allows users to override various blueprint settings via URL query parameters:
 * - `php`: Override PHP version
 * - `wp`: Override WordPress version
 * - `networking`: Enable/disable networking
 * - `language`: Set site language
 * - `multisite`: Enable multisite
 * - `login`: Enable/disable auto-login
 * - `url`: Set landing page URL
 * - `core-pr`: Use a WordPress core PR build
 * - `gutenberg-pr`: Install a Gutenberg PR build
 *
 * @param blueprint - The blueprint or blueprint bundle to apply overrides to
 * @param query - URL search parameters containing the overrides
 * @returns The blueprint with overrides applied
 *
 * @example
 * ```ts
 * const blueprint = { landingPage: '/' };
 * const query = new URLSearchParams('php=8.2&wp=6.4&language=es_ES');
 * const updated = await applyQueryOverrides(blueprint, query);
 * // updated.preferredVersions.php === '8.2'
 * // updated.preferredVersions.wp === '6.4'
 * // updated.steps includes setSiteLanguage step
 * ```
 */
export async function applyQueryOverrides(
	blueprint: BlueprintV1Declaration | BlueprintBundle,
	query: URLSearchParams
): Promise<BlueprintV1Declaration | BlueprintBundle> {
	/**
	 * Allow overriding PHP and WordPress versions defined in a Blueprint
	 * via query params.
	 */
	if (isBlueprintBundle(blueprint)) {
		let blueprintObject = await getBlueprintDeclaration(blueprint);
		blueprintObject = applyQueryOverridesToDeclaration(
			blueprintObject,
			query
		);
		return new OverlayFilesystem([
			new InMemoryFilesystem({
				'blueprint.json': JSON.stringify(blueprintObject),
			}),
			blueprint,
		]);
	} else {
		return applyQueryOverridesToDeclaration(blueprint, query);
	}
}

function applyQueryOverridesToDeclaration(
	blueprint: BlueprintV1Declaration,
	query: URLSearchParams
): BlueprintV1Declaration {
	/**
	 * Allow overriding PHP and WordPress versions defined in a Blueprint
	 * via query params.
	 */
	if (!blueprint.preferredVersions) {
		blueprint.preferredVersions = {} as any;
	}
	blueprint.preferredVersions!.php =
		(query.get('php') as any) ||
		blueprint.preferredVersions!.php ||
		RecommendedPHPVersion;
	blueprint.preferredVersions!.wp =
		query.get('wp') || blueprint.preferredVersions!.wp || 'latest';

	// Features
	if (!blueprint.features) {
		blueprint.features = {};
	}

	/**
	 * Networking is enabled by default, so we only need to disable it
	 * if the query param is explicitly set to something other than "yes".
	 */
	if (query.get('networking') && query.get('networking') !== 'yes') {
		blueprint.features['networking'] = false;
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

	if (query.has('core-pr')) {
		const prNumber = query.get('core-pr');
		blueprint.preferredVersions!.wp = `https://playground.wordpress.net/plugin-proxy.php?org=WordPress&repo=wordpress-develop&workflow=Test%20Build%20Processes&artifact=wordpress-build-${prNumber}&pr=${prNumber}`;
	}

	if (query.has('gutenberg-pr')) {
		const prNumber = query.get('gutenberg-pr');
		blueprint.steps = blueprint.steps || [];
		blueprint.steps.unshift(
			{
				step: 'mkdir',
				path: '/tmp/pr',
			},
			{
				step: 'writeFile',
				path: '/tmp/pr/pr.zip',
				data: {
					resource: 'url',
					url: `/plugin-proxy.php?org=WordPress&repo=gutenberg&workflow=Build%20Gutenberg%20Plugin%20Zip&artifact=gutenberg-plugin&pr=${prNumber}`,
					caption: `Downloading Gutenberg PR ${prNumber}`,
				},
			},
			/**
			 * GitHub CI artifacts are doubly zipped:
			 *
			 * pr.zip
			 *    gutenberg.zip
			 *       gutenberg.php
			 *       ... other files ...
			 *
			 * This step extracts the inner zip file so that we get
			 * access directly to gutenberg.zip and can use it to
			 * install the plugin.
			 */
			{
				step: 'unzip',
				zipPath: '/tmp/pr/pr.zip',
				extractToPath: '/tmp/pr',
			},
			{
				step: 'installPlugin',
				pluginData: {
					resource: 'vfs',
					path: '/tmp/pr/gutenberg.zip',
				},
			}
		);
	}

	return blueprint;
}
