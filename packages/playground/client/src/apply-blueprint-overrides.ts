import type {
	BlueprintV1Declaration,
	BlueprintV1,
	BlueprintBundle,
} from '@wp-playground/blueprints';
import { isBlueprintBundle } from '@wp-playground/blueprints';
import { RecommendedPHPVersion } from '@wp-playground/common';
import type { BlueprintOverrides } from './index';

/**
 * Apply BlueprintOverrides to a Blueprint v1.
 * This is used by the v1 handler to reconcile URL parameter overrides
 * with the blueprint definition.
 *
 * Note: For bundle blueprints, this only works on the in-memory representation.
 * The bundle itself is not modified.
 */
export function applyBlueprintOverrides(
	blueprint: BlueprintV1,
	overrides: BlueprintOverrides
): BlueprintV1 {
	// If it's a bundle, we can't modify it - return as is
	// The overrides will be applied during compilation
	if (isBlueprintBundle(blueprint)) {
		return blueprint;
	}

	return applyOverridesToDeclaration(blueprint, overrides);
}

function applyOverridesToDeclaration(
	blueprint: BlueprintV1Declaration,
	overrides: BlueprintOverrides
): BlueprintV1Declaration {
	// Create a mutable copy of the blueprint to avoid mutating the original
	// (which may be frozen/sealed from Redux store)
	const mutableBlueprint: BlueprintV1Declaration = {
		...blueprint,
		preferredVersions: blueprint.preferredVersions
			? { ...blueprint.preferredVersions }
			: ({} as any),
		features: blueprint.features ? { ...blueprint.features } : {},
		steps: blueprint.steps ? [...blueprint.steps] : [],
	};

	// Apply PHP version override
	if (overrides.blueprintOverrides?.phpVersion) {
		mutableBlueprint.preferredVersions!.php = overrides.blueprintOverrides
			.phpVersion as any;
	} else if (!mutableBlueprint.preferredVersions!.php) {
		mutableBlueprint.preferredVersions!.php = RecommendedPHPVersion;
	}

	// Apply WordPress version override
	if (overrides.blueprintOverrides?.wordpressVersion) {
		mutableBlueprint.preferredVersions!.wp =
			overrides.blueprintOverrides.wordpressVersion;
	} else if (!mutableBlueprint.preferredVersions!.wp) {
		mutableBlueprint.preferredVersions!.wp = 'latest';
	}

	// Apply network access override
	if (overrides.applicationOptions?.networkAccess !== undefined) {
		mutableBlueprint.features!['networking'] =
			overrides.applicationOptions.networkAccess;
	}

	// Apply login override
	if (overrides.applicationOptions?.login !== undefined) {
		mutableBlueprint.login = overrides.applicationOptions.login;
	}

	// Apply landing page override
	if (overrides.applicationOptions?.landingPage) {
		mutableBlueprint.landingPage = overrides.applicationOptions.landingPage;
	}

	// Apply additional steps (language, multisite, Gutenberg PR, etc.)
	if (overrides.blueprintOverrides?.additionalSteps) {
		for (const step of overrides.blueprintOverrides.additionalSteps) {
			// Check if this step type already exists to avoid duplicates
			const stepType = (step as any).step;
			const existingStep = mutableBlueprint.steps!.find(
				(s) => s && (s as any).step === stepType
			);

			// For some steps like setSiteLanguage, we want to avoid duplicates
			// For others like mkdir/writeFile/unzip/installPlugin, we want to add them
			if (!existingStep || stepType !== 'setSiteLanguage') {
				if (stepType === 'mkdir' || stepType === 'writeFile') {
					// Add these at the beginning for PR installations
					mutableBlueprint.steps!.unshift(step);
				} else {
					mutableBlueprint.steps!.push(step);
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
	if (mutableBlueprint.preferredVersions?.wp === '6.3') {
		mutableBlueprint.steps!.unshift({
			step: 'defineWpConfigConsts',
			consts: {
				WP_DEVELOPMENT_MODE: 'all',
			},
		});
	}

	return mutableBlueprint;
}
