import {
	LatestSupportedPHPVersion,
	SupportedPHPVersions,
} from '@php-wasm/universal';
import type { BlueprintV1Declaration } from './types';
import type { RuntimeConfiguration } from '../types';
import { compileVersion } from './compile';
import { RecommendedPHPVersion } from '@wp-playground/common';

export function getRuntimeConfigurationFromBlueprintV1Declaration(
	blueprint: BlueprintV1Declaration,
	overrides = new URLSearchParams({})
): RuntimeConfiguration {
	return {
		preferredVersions: {
			php:
				compileVersion(
					overrides.get('php') || blueprint.preferredVersions?.php,
					SupportedPHPVersions,
					LatestSupportedPHPVersion
				) || RecommendedPHPVersion,
			wp:
				overrides.get('wp') ||
				blueprint.preferredVersions?.wp ||
				'latest',
		},
		features: {
			// @TODO: Enable intl by default in Node.js but not in the browser.
			intl:
				overrides.get('intl') === 'yes' ||
				(blueprint.features?.intl ?? false),
			networking:
				/**
				 * Networking is enabled by default, so we only need to disable it
				 * if the query param is explicitly set to something other than "yes".
				 */
				overrides.get('networking') === 'no'
					? false
					: blueprint.features?.networking ?? true,
		},
		extraLibraries: blueprint.extraLibraries || [],
	};
}
