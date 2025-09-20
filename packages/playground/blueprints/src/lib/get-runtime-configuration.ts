import { BlueprintReflection } from './reflection';
import { getRuntimeConfigurationFromBlueprintV1Declaration } from './v1/get-runtime-configuration';
import { getRuntimeConfigurationFromBlueprintV2Declaration } from './v2/get-runtime-configuration';
import type { BlueprintDeclaration, RuntimeConfiguration } from './types';
import type { BlueprintV1Declaration } from './v1/types';
import type { BlueprintV2Declaration } from './v2/blueprint-v2-declaration';
import {
	LatestSupportedPHPVersion,
	type SupportedPHPVersion,
	SupportedPHPVersions,
} from '@php-wasm/universal';

type Nullable<T> = {
	[K in keyof T]: T[K] | null;
};

export function resolveRuntimeConfiguration({
	blueprint,
	defaults,
	overrides = {},
}: {
	blueprint: BlueprintDeclaration;
	defaults: RuntimeConfiguration;
	overrides?: Partial<Nullable<RuntimeConfiguration<string>>>;
}): RuntimeConfiguration<SupportedPHPVersion> {
	const configuration =
		BlueprintReflection.createFromDeclaration(blueprint).getVersion() === 1
			? getRuntimeConfigurationFromBlueprintV1Declaration(
					blueprint as BlueprintV1Declaration
			  )
			: getRuntimeConfigurationFromBlueprintV2Declaration(
					blueprint as BlueprintV2Declaration
			  );

	const phpVersion =
		overrides.phpVersion ?? configuration.phpVersion ?? defaults.phpVersion;
	return {
		phpVersion: SupportedPHPVersions.includes(phpVersion as any)
			? (phpVersion as SupportedPHPVersion)
			: LatestSupportedPHPVersion,
		wpVersion:
			overrides.wpVersion ??
			configuration.wpVersion ??
			defaults.wpVersion,
		intl: overrides.intl ?? configuration.intl ?? defaults.intl,
		networking:
			overrides.networking ??
			configuration.networking ??
			defaults.networking,
		extraLibraries:
			overrides.extraLibraries ??
			configuration.extraLibraries ??
			defaults.extraLibraries,
	};
}
