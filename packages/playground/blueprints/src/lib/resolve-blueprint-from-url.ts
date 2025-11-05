import type { BlueprintV1 } from './v1/types';
import type { StepDefinition } from './steps';
import { resolveRemoteBlueprint } from './resolve-remote-blueprint';
import { parseBlueprint } from './utils/parse-blueprint';

/**
 * The source of a resolved blueprint.
 */
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

/**
 * A blueprint resolved from a URL along with metadata about its source.
 */
export type ResolvedBlueprint = {
	blueprint: BlueprintV1;
	source: BlueprintSource;
};

/**
 * Resolve a blueprint from a URL.
 *
 * This function supports multiple ways of passing blueprints:
 * 1. Via `blueprint-url` query parameter pointing to a remote blueprint JSON
 * 2. Via URL hash fragment containing inline JSON or base64-encoded JSON
 * 3. Via legacy query parameters (plugin, theme, import-wxr, import-site)
 * 4. Via a default blueprint URL when the URL has no parameters
 *
 * @param url - The URL to extract blueprint information from
 * @param defaultBlueprint - Default blueprint URL to use when the URL has no parameters or fragment
 * @returns A promise that resolves to the blueprint and its source metadata
 *
 * @example
 * ```ts
 * // From query parameter
 * const url = new URL('https://example.com/?blueprint-url=https://example.com/blueprint.json');
 * const { blueprint, source } = await resolveBlueprintFromURL(url);
 *
 * // From URL fragment
 * const url2 = new URL('https://example.com/#{"landingPage": "/?p=4"}');
 * const { blueprint: blueprint2 } = await resolveBlueprintFromURL(url2);
 *
 * // From query params with default
 * const url3 = new URL('https://example.com/');
 * const { blueprint: blueprint3 } = await resolveBlueprintFromURL(url3, 'https://example.com/default.json');
 * ```
 */
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
		typeof window !== 'undefined' &&
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
		// They are added by applyQueryOverrides() to ensure they're also applied
		// to Blueprints passed via the hash fragment (#{...}) or via the
		// `blueprint-url` query param.
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
