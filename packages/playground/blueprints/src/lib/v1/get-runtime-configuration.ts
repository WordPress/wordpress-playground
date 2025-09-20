import type { RuntimeConfiguration } from '../types';
import type { BlueprintV1Declaration } from './types';

export function getRuntimeConfigurationFromBlueprintV1Declaration(
	blueprint: BlueprintV1Declaration
): Partial<RuntimeConfiguration<string>> {
	return {
		phpVersion: blueprint.preferredVersions?.php,
		wpVersion: blueprint.preferredVersions?.wp,
		intl: blueprint.features?.intl,
		networking: blueprint.features?.networking,
		extraLibraries: blueprint.extraLibraries,
	};
}
