import type { RuntimeConfiguration } from '../types';
import { type BlueprintV2Declaration } from './blueprint-v2-declaration';

export function getRuntimeConfigurationFromBlueprintV2Declaration(
	blueprint: BlueprintV2Declaration,
	overrides = new URLSearchParams({})
): RuntimeConfiguration {
	const analyzer = new BlueprintV2DeclarationAnalyzer(blueprint);
	return {
		preferredVersions: {
			wp: overrides.get('wp') || analyzer.getWpVersion() || 'latest',
			php: overrides.get('php') || analyzer.getPhpVersion() || 'latest',
		},
		features: {
			// @TODO: Enable intl by default in Node.js but not in the browser.
			intl:
				overrides.get('intl') === 'yes' ||
				(analyzer.getIntl() ?? false),
			networking:
				/**
				 * Networking is enabled by default, so we only need to disable it
				 * if the query param is explicitly set to something other than "yes".
				 */
				overrides.get('networking') === 'no'
					? false
					: analyzer.getNetworking() ?? true,
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
