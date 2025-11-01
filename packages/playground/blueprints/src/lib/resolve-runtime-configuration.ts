import { RecommendedPHPVersion } from '@wp-playground/common';
import type { SupportedPHPVersion } from '@php-wasm/universal';
import { BlueprintReflection } from './reflection';
import type { Blueprint, RuntimeConfiguration } from './types';
import { compileBlueprintV1 } from './v1/compile';
import type { BlueprintV1 } from './v1/types';

/**
 * BlueprintOverrides type - matches the type from @wp-playground/client
 * but defined here to avoid circular dependencies.
 */
export interface BlueprintOverrides {
	blueprintOverrides?: {
		wordpressVersion?: string;
		phpVersion?: string;
		additionalSteps?: any[];
	};
	applicationOptions?: {
		landingPage?: string;
		login?: boolean;
		networkAccess?: boolean;
	};
}

export async function resolveRuntimeConfiguration(
	blueprint: Blueprint,
	overrides?: BlueprintOverrides
): Promise<RuntimeConfiguration> {
	const reflection = await BlueprintReflection.create(blueprint);
	if (reflection.getVersion() === 1) {
		const compiledBlueprint = await compileBlueprintV1(
			blueprint as BlueprintV1
		);
		return {
			wpVersion: compiledBlueprint.versions.wp,
			phpVersion: compiledBlueprint.versions.php,
			intl: compiledBlueprint.features.intl,
			networking: compiledBlueprint.features.networking,
			extraLibraries: compiledBlueprint.extraLibraries,
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
		};
	} else {
		// For Blueprint v2, compute runtime configuration from the blueprint and overrides
		const declaration = reflection.getDeclaration() as any;

		// Determine WordPress version (priority: override > blueprint > default)
		const wpVersion =
			overrides?.blueprintOverrides?.wordpressVersion ||
			declaration.wordpressVersion ||
			'latest';

		// Determine PHP version (priority: override > blueprint > default)
		let phpVersion: SupportedPHPVersion = RecommendedPHPVersion;
		if (overrides?.blueprintOverrides?.phpVersion) {
			phpVersion = overrides.blueprintOverrides
				.phpVersion as SupportedPHPVersion;
		} else if (declaration.phpVersion) {
			// Handle both string and object forms of phpVersion
			if (typeof declaration.phpVersion === 'string') {
				phpVersion = declaration.phpVersion as SupportedPHPVersion;
			} else if (declaration.phpVersion.recommended) {
				phpVersion = declaration.phpVersion
					.recommended as SupportedPHPVersion;
			}
		}

		// Determine networking (priority: override > blueprint > default)
		const networking =
			overrides?.applicationOptions?.networkAccess ??
			declaration.applicationOptions?.['wordpress-playground']
				?.networkAccess ??
			true;

		return {
			phpVersion,
			wpVersion,
			intl: false,
			networking,
			constants: {},
			extraLibraries: [],
		};
	}
}
