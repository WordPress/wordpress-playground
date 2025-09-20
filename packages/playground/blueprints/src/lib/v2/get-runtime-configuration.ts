import type { RuntimeConfiguration } from '../types';
import { type BlueprintV2Declaration } from './blueprint-v2-declaration';

export function getRuntimeConfigurationFromBlueprintV2Declaration(
	blueprint: BlueprintV2Declaration
): Partial<RuntimeConfiguration<string>> {
	return {
		wpVersion: getWordPressVersion(blueprint),
		phpVersion:
			typeof blueprint.phpVersion === 'string'
				? blueprint.phpVersion
				: blueprint.phpVersion?.recommended ||
				  blueprint.phpVersion?.max ||
				  blueprint.phpVersion?.min,
		intl: (blueprint.applicationOptions?.['wordpress-playground'] as any)
			?.intlExtension,
		networking:
			blueprint.applicationOptions?.['wordpress-playground']
				?.networkAccess,
	};
}

function getWordPressVersion(blueprint: BlueprintV2Declaration) {
	const wordpressVersion = blueprint.wordpressVersion;
	if (!wordpressVersion) {
		return undefined;
	}
	if (typeof wordpressVersion !== 'string') {
		if (
			'preferred' in wordpressVersion ||
			'max' in wordpressVersion ||
			'min' in wordpressVersion
		) {
			return (
				wordpressVersion.preferred ||
				wordpressVersion.max ||
				wordpressVersion.min
			);
		}
		return 'custom';
	}
	return wordpressVersion;
}
