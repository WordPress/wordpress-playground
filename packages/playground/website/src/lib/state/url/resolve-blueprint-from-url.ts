import type {
	BlueprintV1Declaration,
	BlueprintBundle,
	StepDefinition,
	BlueprintV1,
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

const githubBlobOrRawPathPattern = /^\/([^/]+)\/([^/]+)\/(?:blob|raw)\//;

function normalizeBlueprintUrl(remoteUrl: string): string {
	try {
		const parsedUrl = new URL(remoteUrl);
		if (parsedUrl.hostname !== 'github.com') {
			return remoteUrl;
		}
		const rewrittenPath = parsedUrl.pathname.replace(
			githubBlobOrRawPathPattern,
			'/$1/$2/'
		);
		if (rewrittenPath === parsedUrl.pathname) {
			return remoteUrl;
		}
		parsedUrl.pathname = rewrittenPath;
		parsedUrl.hostname = 'raw.githubusercontent.com';
		return parsedUrl.toString();
	} catch {
		return remoteUrl;
	}
}

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
		const blueprintUrl = normalizeBlueprintUrl(query.get('blueprint-url')!);
		return {
			blueprint: await resolveRemoteBlueprint(blueprintUrl),
			source: {
				type: 'remote-url',
				url: blueprintUrl,
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
							}) as StepDefinition
					),
				].filter(Boolean),
			},
			source: {
				type: 'none',
			},
		};
	}
}

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

	// Handle WordPress core PR preview
	const coreRef = query.get('core-pr');
	if (coreRef) {
		// For WordPress PRs: artifact name is wordpress-build-{PR_NUMBER}
		const artifactName = `wordpress-build-${coreRef}`;
		blueprint.preferredVersions!.wp = `https://playground.wordpress.net/plugin-proxy.php?org=WordPress&repo=wordpress-develop&workflow=Test%20Build%20Processes&artifact=${artifactName}&pr=${coreRef}`;
	}

	// Handle Gutenberg PR or branch preview
	const gutenbergRef =
		query.get('gutenberg-pr') || query.get('gutenberg-branch');
	if (gutenbergRef) {
		const refType = query.has('gutenberg-pr') ? 'pr' : 'branch';
		const refLabel = query.has('gutenberg-pr') ? 'PR' : 'branch';
		blueprint.steps = blueprint.steps || [];
		blueprint.steps.unshift(
			{
				step: 'mkdir',
				path: '/tmp/gutenberg',
			},
			{
				step: 'writeFile',
				path: '/tmp/gutenberg/artifact.zip',
				data: {
					resource: 'url',
					url: `/plugin-proxy.php?org=WordPress&repo=gutenberg&workflow=Build%20Gutenberg%20Plugin%20Zip&artifact=gutenberg-plugin&${refType}=${gutenbergRef}`,
					caption: `Downloading Gutenberg ${refLabel} ${gutenbergRef}`,
				},
			},
			/**
			 * GitHub CI artifacts are doubly zipped:
			 *
			 * artifact.zip
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
				zipPath: '/tmp/gutenberg/artifact.zip',
				extractToPath: '/tmp/gutenberg',
			},
			{
				step: 'installPlugin',
				pluginData: {
					resource: 'vfs',
					path: '/tmp/gutenberg/gutenberg.zip',
				},
			}
		);
	}

	return blueprint;
}
