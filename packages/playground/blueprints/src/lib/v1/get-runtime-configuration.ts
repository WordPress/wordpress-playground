import {
	LatestSupportedPHPVersion,
	SupportedPHPVersions,
} from '@php-wasm/universal';
import type { BlueprintV1Declaration } from './types';
import type { RuntimeConfiguration } from '../types';
import { compileVersion } from './compile';

export function getRuntimeConfigurationFromBlueprintV1Declaration(
	blueprint: BlueprintV1Declaration
): RuntimeConfiguration {
	return {
		preferredVersions: {
			php:
				compileVersion(
					blueprint.preferredVersions?.php,
					SupportedPHPVersions,
					LatestSupportedPHPVersion
				) || 'latest',
			wp: blueprint.preferredVersions?.wp || 'latest',
		},
		features: {
			// Disable intl by default to reduce the transfer size
			intl: blueprint.features?.intl ?? false,
			// Enable network access by default
			networking: blueprint.features?.networking ?? true,
		},
		extraLibraries: blueprint.extraLibraries || [],
	};
}
