import type {
	BlueprintV1Declaration,
	BlueprintBundle,
	StepDefinition,
	BlueprintV1,
	BlueprintOverrides,
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
	blueprint: BlueprintV1;
	source: BlueprintSource;
};

export async function resolveBlueprintFromURL(
	url: URL,
	defaultBlueprint?: string
): Promise<ResolvedBlueprint> {
	const query = url.searchParams;
	const fragment = decodeURI(url.hash || '#').substring(1);

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
		return {
			blueprint: await resolveRemoteBlueprint(defaultBlueprint),
			source: {
				type: 'remote-url',
				url: defaultBlueprint,
			},
		};
	} else if (query.has('blueprint-url')) {
		/*
		 * Support passing blueprints via query parameter, e.g.:
		 * ?blueprint-url=https://example.com/blueprint.json
		 */
		return {
			blueprint: await resolveRemoteBlueprint(
				query.get('blueprint-url')!
			),
			source: {
				type: 'remote-url',
				url: query.get('blueprint-url')!,
			},
		};
	} else if (fragment.length) {
		/*
		 * Support passing blueprints in the URI fragment, e.g.:
		 * /#{"landingPage": "/?p=4"}
		 */
		return {
			blueprint: parseBlueprint(fragment),
			source: {
				type: 'inline-string',
			},
		};
	} else {
		const importWxrQueryArg =
			query.get('import-wxr') || query.get('import-content');

		// This Blueprint is intentionally missing most query args (like login).
		// They are added below to ensure they're also applied to Blueprints passed
		// via the hash fragment (#{...}) or via the `blueprint-url` query param.
		return {
			blueprint: {
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
			},
			source: {
				type: 'none',
			},
		};
	}
}

/**
 * Apply Blueprint overrides to a Blueprint v1 declaration or bundle.
 * Extracts overrides from URL parameters and applies them to the blueprint.
 *
 * @param blueprint The Blueprint v1 declaration or bundle to modify
 * @param query URL search parameters containing overrides
 * @returns Modified blueprint with overrides applied
 */
export async function applyQueryOverrides(
	blueprint: BlueprintV1Declaration | BlueprintBundle,
	query: URLSearchParams
): Promise<BlueprintV1Declaration | BlueprintBundle> {
	const overrides = extractBlueprintOverridesFromURL(query);

	if (isBlueprintBundle(blueprint)) {
		let blueprintObject = await getBlueprintDeclaration(blueprint);
		blueprintObject = applyOverridesToV1Declaration(
			blueprintObject,
			overrides
		);
		return new OverlayFilesystem([
			new InMemoryFilesystem({
				'blueprint.json': JSON.stringify(blueprintObject),
			}),
			blueprint,
		]);
	} else {
		return applyOverridesToV1Declaration(blueprint, overrides);
	}
}

/**
 * Apply overrides to a Blueprint v1 declaration.
 * Translates the unified overrides object into v1 Blueprint structure modifications.
 */
function applyOverridesToV1Declaration(
	blueprint: BlueprintV1Declaration,
	overrides: BlueprintOverrides
): BlueprintV1Declaration {
	// Initialize blueprint structures if needed
	if (!blueprint.preferredVersions) {
		blueprint.preferredVersions = {} as any;
	}
	if (!blueprint.features) {
		blueprint.features = {};
	}
	if (!blueprint.steps) {
		blueprint.steps = [];
	}

	// Apply PHP version override
	if (overrides.blueprintOverrides?.phpVersion) {
		blueprint.preferredVersions!.php = overrides.blueprintOverrides
			.phpVersion as any;
	} else if (!blueprint.preferredVersions!.php) {
		blueprint.preferredVersions!.php = RecommendedPHPVersion;
	}

	// Apply WordPress version override
	if (overrides.blueprintOverrides?.wordpressVersion) {
		blueprint.preferredVersions!.wp =
			overrides.blueprintOverrides.wordpressVersion;
	} else if (!blueprint.preferredVersions!.wp) {
		blueprint.preferredVersions!.wp = 'latest';
	}

	// Apply network access override
	if (overrides.applicationOptions?.networkAccess !== undefined) {
		blueprint.features['networking'] =
			overrides.applicationOptions.networkAccess;
	}

	// Apply login override
	if (overrides.applicationOptions?.login !== undefined) {
		blueprint.login = overrides.applicationOptions.login;
	}

	// Apply landing page override
	if (overrides.applicationOptions?.landingPage) {
		blueprint.landingPage = overrides.applicationOptions.landingPage;
	}

	// Apply additional steps (language, multisite, Gutenberg PR, etc.)
	if (overrides.blueprintOverrides?.additionalSteps) {
		for (const step of overrides.blueprintOverrides.additionalSteps) {
			// Check if this step type already exists to avoid duplicates
			const stepType = (step as any).step;
			const existingStep = blueprint.steps.find(
				(s) => s && (s as any).step === stepType
			);

			// For some steps like setSiteLanguage, we want to avoid duplicates
			// For others like mkdir/writeFile/unzip/installPlugin, we want to add them
			if (!existingStep || stepType !== 'setSiteLanguage') {
				if (stepType === 'mkdir' || stepType === 'writeFile') {
					// Add these at the beginning for PR installations
					blueprint.steps.unshift(step);
				} else {
					blueprint.steps.push(step);
				}
			}
		}
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
		blueprint.steps.unshift({
			step: 'defineWpConfigConsts',
			consts: {
				WP_DEVELOPMENT_MODE: 'all',
			},
		});
	}

	return blueprint;
}

/**
 * Extract Blueprint overrides from URL query parameters.
 * This creates a unified overrides object that can be used for both:
 * - Blueprint v1: Applied directly to the blueprint via applyQueryOverrides()
 * - Blueprint v2: Passed to runBlueprintV2() as blueprintOverrides
 *
 * Supported URL parameters:
 * - ?wp=6.3 - Override WordPress version
 * - ?php=8.0 - Override PHP version
 * - ?language=es_ES - Set site language
 * - ?multisite=yes - Enable multisite
 * - ?url=/some-path - Set landing page
 * - ?login=yes/no - Control login behavior
 * - ?networking=yes/no - Control network access
 * - ?core-pr=12345 - Use WordPress core PR build
 * - ?gutenberg-pr=67890 - Use Gutenberg PR build
 */
export function extractBlueprintOverridesFromURL(
	query: URLSearchParams
): BlueprintOverrides {
	const result: BlueprintOverrides = {};

	// WordPress version override
	if (query.get('wp')) {
		result.blueprintOverrides = result.blueprintOverrides || {};
		result.blueprintOverrides.wordpressVersion = query.get('wp')!;
	}

	// Core PR override
	if (query.has('core-pr')) {
		const prNumber = query.get('core-pr');
		result.blueprintOverrides = result.blueprintOverrides || {};
		result.blueprintOverrides.wordpressVersion = `https://playground.wordpress.net/plugin-proxy.php?org=WordPress&repo=wordpress-develop&workflow=Test%20Build%20Processes&artifact=wordpress-build-${prNumber}&pr=${prNumber}`;
	}

	// PHP version override
	if (query.get('php')) {
		result.blueprintOverrides = result.blueprintOverrides || {};
		result.blueprintOverrides.phpVersion = query.get('php')!;
	}

	// Additional steps array for various overrides
	const additionalSteps: any[] = [];

	// Language override
	if (query.get('language')) {
		additionalSteps.push({
			step: 'setSiteLanguage',
			language: query.get('language')!,
		});
	}

	// Multisite override
	if (query.get('multisite') === 'yes') {
		additionalSteps.push({
			step: 'enableMultisite',
		});
	}

	// Gutenberg PR override
	if (query.has('gutenberg-pr')) {
		const prNumber = query.get('gutenberg-pr');
		additionalSteps.push(
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

	if (additionalSteps.length > 0) {
		result.blueprintOverrides = result.blueprintOverrides || {};
		result.blueprintOverrides.additionalSteps = additionalSteps;
	}

	// Application options (Playground-specific)
	result.applicationOptions = {};

	// Landing page
	if (query.get('url')) {
		result.applicationOptions.landingPage = query.get('url')!;
	}

	// Login control
	if (query.get('login') !== null) {
		result.applicationOptions.login = query.get('login') !== 'no';
	}

	// Network access
	if (query.get('networking')) {
		result.applicationOptions.networkAccess =
			query.get('networking') === 'yes';
	}

	return result;
}
