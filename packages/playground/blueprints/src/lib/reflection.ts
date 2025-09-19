import type { SupportedPHPVersion } from '@php-wasm/universal';
import type { Blueprint, BlueprintBundle } from './types';
import type { BlueprintV1Declaration, ExtraLibrary } from './v1/types';
import type { BlueprintV2Declaration } from './v2/blueprint-v2-declaration';

export function isBlueprintBundle(input: any): input is BlueprintBundle {
	return input && 'read' in input && typeof input.read === 'function';
}

export async function getBlueprintDeclaration(
	blueprint: Blueprint
): Promise<BlueprintV1Declaration | BlueprintV2Declaration> {
	if (!isBlueprintBundle(blueprint)) {
		return blueprint;
	}
	const blueprintFile = await blueprint.read('blueprint.json');
	const blueprintText = await blueprintFile.text();
	return JSON.parse(blueprintText);
}

export type BlueprintType = 'bundle' | 'declaration';

export abstract class BlueprintReflection<
	T extends BlueprintV1Declaration | BlueprintV2Declaration
> {
	private updatedBundle?: BlueprintBundle;

	static async create(blueprint: Blueprint) {
		const declaration = await getBlueprintDeclaration(blueprint);
		const details = {
			declaration,
			bundle: isBlueprintBundle(blueprint) ? blueprint : undefined,
			version: (declaration as any).version || 1,
		};
		if (details.version === 1) {
			return new BlueprintV1Reflection(details as any);
		} else if (details.version === 2) {
			return new BlueprintV2Reflection(details as any);
		} else {
			throw new Error('Invalid blueprint version');
		}
	}

	protected constructor(
		private readonly details: {
			declaration: T;
			bundle: BlueprintBundle | undefined;
			version: number;
		}
	) {}

	getVersion() {
		return this.details.version;
	}

	getDeclaration() {
		return this.details.declaration;
	}

	getBundle() {
		return this.updatedBundle || this.details.bundle;
	}

	getBlueprint(): Blueprint {
		return this.getBundle() || this.getDeclaration();
	}

	abstract getPhpVersion(): SupportedPHPVersion | 'latest' | undefined;
	abstract getWpVersion(): string | 'latest' | undefined;
	abstract getNetworking(): boolean;
	abstract getExtraLibraries(): ExtraLibrary[];
}

const VERSION_REGEX = new RegExp(
	`^\\s*(\\d+)(?:\\.(\\d+))?(?:\\.(\\d+))?(?:[.\\-]?([a-zA-Z]+)(\\d*))?(?:[.\\-]src)?(?:[.\\-](\\d+))?\\s*$`
);

export class BlueprintV1Reflection extends BlueprintReflection<BlueprintV1Declaration> {
	getPhpVersion() {
		return this.getDeclaration().preferredVersions?.php;
	}

	getWpVersion() {
		const wpVersion = this.getDeclaration().preferredVersions?.wp;
		if (!wpVersion || typeof wpVersion !== 'string') {
			return undefined;
		}
		if (wpVersion === 'latest') {
			return 'latest';
		}
		if (!VERSION_REGEX.test(wpVersion)) {
			return 'custom';
		}
		return wpVersion;
	}

	getNetworking() {
		return this.getDeclaration().features?.networking || true;
	}

	getIntl() {
		return this.getDeclaration().features?.intl ?? false;
	}

	getExtraLibraries() {
		return this.getDeclaration().extraLibraries || [];
	}
}

export class BlueprintV2Reflection extends BlueprintReflection<BlueprintV2Declaration> {
	getPhpVersion() {
		const phpVersion = this.getDeclaration().phpVersion;
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
		const wordpressVersion = this.getDeclaration().wordpressVersion;
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
		if (wordpressVersion === 'latest') {
			return 'latest';
		}
		if (!VERSION_REGEX.test(wordpressVersion)) {
			return 'custom';
		}
		return wordpressVersion;
	}

	getNetworking() {
		return (
			this.getDeclaration().applicationOptions?.['wordpress-playground']
				?.networkAccess || true
		);
	}

	getIntl() {
		// @TODO: Find a useful way of declaring the desired PHP extensions
		//        from a v2 Blueprint.
		return (
			(
				this.getDeclaration().applicationOptions?.[
					'wordpress-playground'
				] as any
			)?.intlExtension || true
		);
	}

	getExtraLibraries() {
		return [];
	}
}
