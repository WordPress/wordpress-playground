import type {
	BlueprintDeclaration,
	BlueprintBundle,
	Blueprint,
	StepDefinition,
	SupportedPHPVersion,
	BlueprintV2Declaration,
} from '@wp-playground/client';
import {
	getBlueprintDeclaration,
	isBlueprintBundle,
	resolveRemoteBlueprint,
} from '@wp-playground/client';
import { parseBlueprint } from './router';
import { OverlayFilesystem, InMemoryFilesystem } from '@wp-playground/storage';
import { RecommendedPHPVersion } from '@wp-playground/common';

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

	let blueprint:
		| BlueprintDeclaration
		| BlueprintBundle
		| BlueprintV2Declaration;
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

	/**
	 * Allow overriding PHP and WordPress versions defined in a Blueprint
	 * via query params.
	 */
	if (isBlueprintBundle(blueprint)) {
		let blueprintObject = await getBlueprintDeclaration(blueprint);
		blueprintObject = applyQueryOverrides(blueprintObject, query);
		blueprint = new OverlayFilesystem([
			new InMemoryFilesystem({
				'blueprint.json': JSON.stringify(blueprintObject),
			}),
			blueprint,
		]);
	} else {
		blueprint = applyQueryOverrides(blueprint, query);
	}

	return { blueprint, source };
}

function applyQueryOverrides(
	blueprint: BlueprintDeclaration | BlueprintV2Declaration,
	query: URLSearchParams
): BlueprintDeclaration | BlueprintV2Declaration {
	type Overrides = {
		php: SupportedPHPVersion;
		wp: any;
		login?: boolean;
		landingPage?: string;
		features: {
			networking: boolean;
		};
		steps: StepDefinition[];
	};
	const isV2 = !!blueprint && (blueprint as any).version === 2;
	const isV1 = !isV2;
	const blueprintV2 = blueprint as BlueprintV2Declaration;
	const blueprintV1 = blueprint as BlueprintDeclaration;
	const blueprintSteps = isV1
		? blueprintV1.steps
		: blueprintV2.additionalStepsAfterExecution;

	const overrides: Overrides = {
		php:
			(query.get('php') as any) ||
			(isV1
				? blueprintV1.preferredVersions!.php
				: blueprintV2.phpVersion) ||
			RecommendedPHPVersion,
		wp:
			query.get('wp') ||
			(isV1
				? blueprintV1.preferredVersions!.wp
				: blueprintV2.wordpressVersion) ||
			'latest',
		features: {
			/**
			 * Networking is enabled by default, so we only need to disable it
			 * if the query param is explicitly set to something other than "yes".
			 */
			networking: query.get('networking') !== 'yes',
		},
		steps: [],
	};

	// Language
	if (query.get('language')) {
		if (
			!blueprintSteps?.find(
				(step) => step && (step as any).step === 'setSiteLanguage'
			)
		) {
			overrides.steps?.push({
				step: 'setSiteLanguage',
				language: query.get('language')!,
			});
		}
	}

	// Multisite
	if (query.get('multisite') === 'yes') {
		if (
			!overrides.steps?.find(
				(step) => step && (step as any).step === 'enableMultisite'
			)
		) {
			overrides.steps?.push({
				step: 'enableMultisite',
			});
		}
	}

	// Login
	if (query.get('login') !== 'no') {
		overrides.login = true;
	}

	// Landing page
	if (query.get('url')) {
		overrides.landingPage = query.get('url')!;
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
	if (overrides.wp === '6.3') {
		overrides.steps?.unshift({
			step: 'defineWpConfigConsts',
			consts: {
				WP_DEVELOPMENT_MODE: 'all',
			},
		});
	}

	if (query.has('core-pr')) {
		const prNumber = query.get('core-pr');
		overrides.wp = `https://playground.wordpress.net/plugin-proxy.php?org=WordPress&repo=wordpress-develop&workflow=Test%20Build%20Processes&artifact=wordpress-build-${prNumber}&pr=${prNumber}`;
	}

	if (query.has('gutenberg-pr')) {
		const prNumber = query.get('gutenberg-pr');
		overrides.steps.unshift(
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

	// @TODO: What kind of overrides are needed for version 2? Will we have to support both
	// sets of overrides?
	if ((blueprint as any).version === 2) {
		return {
			...blueprintV2,
			additionalStepsAfterExecution: [
				...(blueprintV2.additionalStepsAfterExecution || []),
				overrides.steps,
			],
			phpVersion: overrides.php,
			wordpressVersion: overrides.wp,
			applicationOptions: {
				'wordpress-playground': {
					login: overrides.login,
					landingPage: overrides.landingPage,
				},
			},
		} as BlueprintV2Declaration;
	} else {
		return {
			...blueprint,
			preferredVersions: {
				php: overrides.php,
				wp: overrides.wp,
			},
			features: overrides.features,
			steps: overrides.steps,
			login: overrides.login,
			landingPage: overrides.landingPage,
		} as BlueprintDeclaration;
	}
}
