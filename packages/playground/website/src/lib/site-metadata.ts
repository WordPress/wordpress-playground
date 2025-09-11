/**
 * Manages site metadata, which is stored in a file called `site-info.json`
 *
 * Today, it's specific to Playground website. Tomorrow, it's meant to be
 * a standardized format for describing a Playground (or even WordPress?)
 * site's configuration, independent of the runtime, e.g. Playground website,
 * Playground CLI, Studio, WP-ENV, hosted environment etc.
 */

import type {
	Blueprint,
	BlueprintDeclaration,
	PHPConstants,
} from '@wp-playground/blueprints';
import {
	compileBlueprint,
	getBlueprintDeclaration,
	isBlueprintBundle,
} from '@wp-playground/blueprints';
import type { SupportedPHPVersion } from '@php-wasm/universal';
import type { BlueprintSource } from './state/url/resolve-blueprint-from-url';
import { resolveBlueprintFromURL } from './state/url/resolve-blueprint-from-url';

/**
 * The supported site storage types.
 *
 * Is it possible to restrict this to those three values for all Playground runtimes?
 * Or should the runtime be allowed to use custom storage types?
 *
 * NOTE: We are using different storage terms than our query API in order
 * to be more explicit about storage medium in the site metadata format.
 */
export const SiteStorageTypes = ['opfs', 'local-fs', 'none'] as const;
export type SiteStorageType = (typeof SiteStorageTypes)[number];

/**
 * The site logo data.
 */
export type SiteLogo = {
	mime: string;
	data: string;
};

// TODO: Create a schema for this as the design matures
/**
 * The Site metadata that is persisted.
 */
export interface SiteMetadata {
	storage: SiteStorageType;
	id: string;
	name: string;
	logo?: SiteLogo;

	// TODO: The designs show keeping admin username and password. Why do we want that?
	whenCreated?: number;
	// TODO: Consider keeping timestamps.
	//       For a user, timestamps might be useful to disambiguate identically-named sites.
	//       For playground, we might choose to sort by most recently used.
	//whenLastLoaded: number;

	// @TODO: Accept any string as a php version?
	runtimeConfiguration: Pick<
		Required<BlueprintDeclaration>,
		'features' | 'extraLibraries' | 'preferredVersions'
	> & {
		constants?: PHPConstants;
	};
	originalBlueprint: Blueprint;
	originalBlueprintSource: BlueprintSource;
}

export async function createSiteMetadata(
	initialMetadata: {
		name: string;
	} & Partial<Omit<SiteMetadata, 'runtimeConfiguration'>>
): Promise<SiteMetadata> {
	const {
		name,
		originalBlueprint,
		originalBlueprintSource,
		...remainingMetadata
	} = initialMetadata;

	let blueprint: Blueprint | undefined = originalBlueprint;
	let blueprintSource: BlueprintSource | undefined = originalBlueprintSource;
	if (!blueprint) {
		// TODO: This is a hack because we are just abusing a URL-oriented
		// function to create a completely default Blueprint. Let's fix this by
		// making default creation first-class.
		const resolvedBlueprint = await resolveBlueprintFromURL(
			new URL('https://w.org')
		);
		blueprint = resolvedBlueprint.blueprint;
		blueprintSource = resolvedBlueprint.source;
	}

	// Derive runtime configuration for both Blueprint v1 and v2 without
	// invoking the v1 compiler for v2 Blueprints (which would fail).
	let preferredPhpVersion: SupportedPHPVersion | undefined = undefined;
	let preferredWpVersion = 'latest';
	let features: Required<NonNullable<BlueprintDeclaration['features']>> = {
		intl: false,
		networking: true,
	};
	let extraLibraries: NonNullable<BlueprintDeclaration['extraLibraries']> =
		[];

	const declaration = isBlueprintBundle(blueprint!)
		? await getBlueprintDeclaration(blueprint!)
		: (blueprint as any);
	const isV2 = !!declaration && (declaration as any).version === 2;

	if (isV2) {
		// v2: Build a minimal v1-style declaration from URL overrides and v2 fields,
		// then compile it to normalize versions/features.
		let phpFromQuery: string | undefined;
		let wpFromQuery: string | undefined;
		let networkingFromQuery: string | undefined;
		try {
			const params = new URLSearchParams(window.location.search);
			phpFromQuery = params.get('php') || undefined;
			wpFromQuery = params.get('wp') || undefined;
			networkingFromQuery = params.get('networking') || undefined;
		} catch {
			// Non-browser context; ignore.
		}

		const synthetic: BlueprintDeclaration = {
			preferredVersions: {
				php: (phpFromQuery as any) ?? undefined,
				wp:
					wpFromQuery ||
					(declaration as any).wordpressVersion ||
					'latest',
			},
			features: {
				intl: false,
				networking:
					networkingFromQuery && networkingFromQuery !== 'yes'
						? false
						: true,
			},
			extraLibraries: [],
		};

		const compiled = await compileBlueprint(synthetic);
		preferredPhpVersion = compiled.versions.php;
		preferredWpVersion = compiled.versions.wp;
		features = compiled.features;
		extraLibraries = compiled.extraLibraries;
	} else if (blueprint) {
		// v1: Compile to reliably normalize versions/features.
		const compiled = await compileBlueprint(blueprint as any); // @TODO: cast to v1 declaration
		preferredPhpVersion = compiled.versions.php;
		preferredWpVersion = compiled.versions.wp;
		features = compiled.features;
		extraLibraries = compiled.extraLibraries;
	}

	return {
		name,
		id: crypto.randomUUID(),
		whenCreated: Date.now(),
		storage: 'none',
		originalBlueprint: blueprint,
		originalBlueprintSource: blueprintSource!,

		...remainingMetadata,

		runtimeConfiguration: {
			preferredVersions: {
				wp: preferredWpVersion,
				php: preferredPhpVersion!,
			},
			features,
			extraLibraries,
			/*
			 * Constants don't matter so much for temporary sites so let's
			 * use an empty object here. We can't easily figure out which
			 * additional constants were applied via playground.defineConstant()
			 * at this stage anyway.
			 *
			 * This property is only relevant for stored sites to ensure they're
			 * consistently applied across page reloads.
			 */
			constants: {},
		},
	};
}
