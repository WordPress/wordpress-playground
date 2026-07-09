import { BlueprintReflection } from './reflection';
import type { Blueprint, RuntimeConfiguration } from './types';
import { compileBlueprintV1 } from './v1/compile';
import type { BlueprintV1 } from './v1/types';
import { resolveBlueprintV2RuntimeConfiguration } from './v2/resolve-runtime-configuration';

/**
 * Resolves the runtime settings required before executing a Blueprint.
 *
 * Blueprint v1 settings come from its compiled form. Blueprint v2 settings are
 * delegated to the v2 runtime configuration resolver.
 */
export async function resolveRuntimeConfiguration(
	blueprint: Blueprint
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
	}

	return resolveBlueprintV2RuntimeConfiguration(reflection.getDeclaration());
}
