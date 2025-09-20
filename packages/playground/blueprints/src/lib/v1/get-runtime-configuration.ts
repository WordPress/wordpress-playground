import {
	LatestSupportedPHPVersion,
	SupportedPHPVersions,
} from '@php-wasm/universal';
import type { BlueprintV1Declaration } from './types';
import type { RuntimeConfiguration } from '../types';
import { compileVersion } from './compile';
import { RecommendedPHPVersion } from '@wp-playground/common';

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
				) || RecommendedPHPVersion,
			wp: blueprint.preferredVersions?.wp || 'latest',
		},
		features: {
			intl: blueprint.features?.intl ?? false,
			networking: blueprint.features?.networking ?? true,
		},
		extraLibraries: blueprint.extraLibraries || [],
	};
}
