import type { RuntimeConfiguration } from '../types';
import { type BlueprintV2Declaration } from './blueprint-v2-declaration';

export function getRuntimeConfigurationFromBlueprintV2Declaration(
	blueprint: BlueprintV2Declaration,
	searchParams: URLSearchParams
): RuntimeConfiguration {
	const analyzer = new BlueprintV2DeclarationAnalyzer(blueprint);
	return {
		preferredVersions: {
			wp: analyzer.getWpVersion() || searchParams.get('wp') || 'latest',
			php:
				analyzer.getPhpVersion() || searchParams.get('php') || 'latest',
		},
		features: {
			intl: analyzer.getIntl() || searchParams.get('intl') === 'yes',
			networking:
				analyzer.getNetworking() ||
				searchParams.get('networking') === 'yes',
		},
		extraLibraries: analyzer.getExtraLibraries() || [],
	};
}
class BlueprintV2DeclarationAnalyzer {
	constructor(private readonly declaration: BlueprintV2Declaration) {}
	getPhpVersion() {
		const phpVersion = this.declaration.phpVersion;
		if (!phpVersion) {
			return undefined;
		}
		if (typeof phpVersion === 'string') {
			return phpVersion;
		}
		return (phpVersion.recommended ||
			phpVersion.max ||
			phpVersion.min) as any;
	}

	getWpVersion() {
		const wordpressVersion = this.declaration.wordpressVersion;
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

	getNetworking() {
		return (
			this.declaration.applicationOptions?.['wordpress-playground']
				?.networkAccess ?? true
		);
	}

	getIntl() {
		// @TODO: Find a useful way of declaring the desired PHP extensions
		//        from a v2 Blueprint.
		return (
			(
				this.declaration.applicationOptions?.[
					'wordpress-playground'
				] as any
			)?.intlExtension ?? true
		);
	}

	getExtraLibraries() {
		return [];
	}
}
