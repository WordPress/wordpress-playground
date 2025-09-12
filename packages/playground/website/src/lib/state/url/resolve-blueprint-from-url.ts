import type { Blueprint, StepDefinition } from '@wp-playground/client';
import {
	BlueprintReflection,
	resolveRemoteBlueprint,
} from '@wp-playground/client';
import { parseBlueprint } from './router';

export type BlueprintSource =
	| {
			type: 'remote-url';
			url: string;
	  }
	| {
			type: 'inline-string';
	  }
	| {
			type: 'none';
	  };

export type ResolvedBlueprint = {
	blueprint: Blueprint;
	source: BlueprintSource;
};

export async function resolveBlueprintFromURL(
	url: URL,
	defaultBlueprint?: string
): Promise<ResolvedBlueprint> {
	const query = url.searchParams;
	const fragment = decodeURI(url.hash || '#').substring(1);

	let blueprint: Blueprint;
	let source: BlueprintSource;

	/**
	 * If the URL has no parameters or fragment, and a default blueprint is provided,
	 * use the default blueprint.
	 */
	if (
		window.self === window.top &&
		!query.size &&
		!fragment.length &&
		defaultBlueprint
	) {
		blueprint = await resolveRemoteBlueprint(defaultBlueprint);
		source = {
			type: 'remote-url',
			url: defaultBlueprint,
		};
	} else if (query.has('blueprint-url')) {
		/*
		 * Support passing blueprints via query parameter, e.g.:
		 * ?blueprint-url=https://example.com/blueprint.json
		 */
		blueprint = await resolveRemoteBlueprint(query.get('blueprint-url')!);
		source = {
			type: 'remote-url',
			url: query.get('blueprint-url')!,
		};
	} else if (fragment.length) {
		/*
		 * Support passing blueprints in the URI fragment, e.g.:
		 * /#{"landingPage": "/?p=4"}
		 */
		blueprint = parseBlueprint(fragment);
		source = {
			type: 'inline-string',
		};
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
					/^(http(s?)):\/\//i.test(importWxrQueryArg) &&
					({
						step: 'importWxr',
						file: {
							resource: 'url',
							url: importWxrQueryArg,
						},
					} as StepDefinition),
				query.get('import-site') &&
					/^(http(s?)):\/\//i.test(query.get('import-site')!) &&
					({
						step: 'importWordPressFiles',
						wordPressFilesZip: {
							resource: 'url',
							url: query.get('import-site')!,
						},
					} as StepDefinition),
				...query.getAll('theme').map(
					(theme, index, themes) =>
						({
							step: 'installTheme',
							themeData: {
								resource: 'wordpress.org/themes',
								slug: theme,
							},
							options: {
								// Activate only the last theme in the list.
								activate: index === themes.length - 1,
							},
							progress: { weight: 2 },
						} as StepDefinition)
				),
			].filter(Boolean),
		};
		source = {
			type: 'none',
		};
	}

	const reflection = await BlueprintReflection.create(blueprint);
	reflection.setDeclaration(applyQueryOverrides(reflection, query) as any);

	return { blueprint: reflection.getBlueprint(), source };
}

function applyQueryOverrides(
	reflection: BlueprintReflection<any>,
	query: URLSearchParams
) {
	const newDeclaration = structuredClone(reflection.getDeclaration());
	if (query.get('php')) {
		reflection.setPhpVersion(query.get('php') as any);
	}
	if (query.get('wp')) {
		reflection.setWpVersion(query.get('wp') as any);
	}
	if (query.get('networking') !== 'yes') {
		/**
		 * Networking is enabled by default, so we only need to disable it
		 * if the query param is explicitly set to something other than "yes".
		 */
		reflection.setNetworking(false);
	}

	const steps = reflection.getDeclaredSteps();
	// Language
	if (query.get('language')) {
		// The syntax is consistent across all Blueprints versions.
		if (
			!steps?.find(
				(step) => step && (step as any).step === 'setSiteLanguage'
			)
		) {
			steps?.push({
				step: 'setSiteLanguage',
				language: query.get('language')!,
			});
		}
	}

	// Multisite
	if (query.get('multisite') === 'yes') {
		if (
			!steps?.find(
				(step) => step && (step as any).step === 'enableMultisite'
			)
		) {
			steps?.push({
				step: 'enableMultisite',
			});
		}
	}

	// Login
	if (query.get('login') !== 'no') {
		reflection.setLogin(true);
	}

	// Landing page
	if (query.get('url')) {
		reflection.setLandingPage(query.get('url')!);
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
	if (reflection.getWpVersion() === '6.3') {
		if (reflection.getVersion() === 1) {
			steps?.unshift({
				step: 'defineWpConfigConsts',
				consts: {
					WP_DEVELOPMENT_MODE: 'all',
				},
			});
		} else {
			steps?.unshift({
				step: 'defineConstants',
				constants: {
					WP_DEVELOPMENT_MODE: 'all',
				},
			});
		}
	}

	if (query.has('core-pr')) {
		const prNumber = query.get('core-pr');
		reflection.setWpVersion(
			`https://playground.wordpress.net/plugin-proxy.php?org=WordPress&repo=wordpress-develop&workflow=Test%20Build%20Processes&artifact=wordpress-build-${prNumber}&pr=${prNumber}`
		);
	}

	if (query.has('gutenberg-pr')) {
		const prNumber = query.get('gutenberg-pr');
		if (reflection.getVersion() === 1) {
			steps?.unshift(
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
					zipFile: '/tmp/pr/pr.zip',
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
		} else {
			steps?.unshift(
				{
					step: 'mkdir',
					path: '/tmp/pr',
				},
				{
					step: 'writeFiles',
					files: {
						'/tmp/pr/pr.zip': `/plugin-proxy.php?org=WordPress&repo=gutenberg&workflow=Build%20Gutenberg%20Plugin%20Zip&artifact=gutenberg-plugin&pr=${prNumber}`,
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
					zipFile: '/tmp/pr/pr.zip',
					extractToPath: '/tmp/pr',
				},
				{
					step: 'installPlugin',
					source: '/tmp/pr/gutenberg.zip',
				}
			);
		}
	}
	return newDeclaration;
}
