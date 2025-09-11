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
	BlueprintV2Declaration,
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
		const blueprintV2 = declaration as BlueprintV2Declaration;
		preferredPhpVersion = blueprintV2.phpVersion as any;
		// @TODO: The type is not compatible with v1 version type
		preferredWpVersion = blueprintV2.wordpressVersion as any;
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
			// @TODO: Rethink why we're storing preferredWpVersion here.
			//        WP core is stored in VFS or OPFS – that's the source of truth.
			//        Keeping it here makes it tricky to handle Blueprints v2 as they
			//        may express their WordPress version in multiple ways that diverge from
			//        the Blueprint v1 version declaration.
			preferredVersions: {
				wp: preferredWpVersion,
				php: preferredPhpVersion!,
			},
			features,
			extraLibraries, // @TODO: Do we need it for Blueprints v2?
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
