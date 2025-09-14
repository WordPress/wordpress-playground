import type { SupportedPHPVersion } from '@php-wasm/universal';
import { InMemoryFilesystem, OverlayFilesystem } from '@wp-playground/storage';
import type {
	Blueprint,
	BlueprintDeclaration,
	BlueprintBundle,
} from './blueprint';

export function isBlueprintBundle(input: any): input is BlueprintBundle {
	return input && 'read' in input && typeof input.read === 'function';
}

async function getBlueprintDeclaration(
	blueprint: Blueprint
): Promise<BlueprintDeclaration> {
	if (!isBlueprintBundle(blueprint)) {
		return blueprint;
	}
	const blueprintFile = await blueprint.read('blueprint.json');
	const blueprintText = await blueprintFile.text();
	return JSON.parse(blueprintText);
}

export type BlueprintType = 'bundle' | 'declaration';

export abstract class BlueprintReflection<T extends BlueprintDeclaration> {
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

	getBlueprint(): Blueprint {
		return this.getBundle() || this.getDeclaration();
	}

	getDeclaration() {
		return this.details.declaration;
	}

	isBundle() {
		return !!this.details.bundle;
	}

	getBundle() {
		return this.updatedBundle || this.details.bundle;
	}

	setDeclaration(declaration: T) {
		if (this.details.bundle) {
			this.updatedBundle = new OverlayFilesystem([
				new InMemoryFilesystem({
					'blueprint.json': JSON.stringify(declaration),
				}),
				this.details.bundle,
			]);
		}
		this.details.declaration = declaration;
	}

	/**
	 * Resolves the PHP version from the Blueprint declaration.
	 */
	abstract resolvePhpVersionString():
		| SupportedPHPVersion
		| 'latest'
		| undefined;
	/**
	 * Returns a WordPress version number, "latest", or, "custom" when the
	 * version definition is more complex and involves, e.g., cloning a
	 * git repository.
	 */
	abstract getSimplifiedWpVersion(): string | 'latest' | undefined;
	/**
	 * Overrides the requested WordPress version with a simple version string
	 * or "latest".
	 * @param wpVersion
	 */
	abstract isNetworkingEnabled(): boolean;
	abstract isIntlExtensionEnabled(): boolean;
	abstract isAutologinEnabled():
		| boolean
		| { username: string; password: string }
		| undefined;
	abstract getLandingPage(): string | undefined;
	abstract isMultisiteEnabled(): boolean;
	abstract getDeclaredSteps(): any[];
}

const VERSION_REGEX = new RegExp(
	`^\\s*(\\d+)(?:\\.(\\d+))?(?:\\.(\\d+))?(?:[.\\-]?([a-zA-Z]+)(\\d*))?(?:[.\\-]src)?(?:[.\\-](\\d+))?\\s*$`
);

export class BlueprintV1Reflection extends BlueprintReflection<BlueprintDeclaration> {
	resolvePhpVersionString() {
		return this.getDeclaration().preferredVersions?.php;
	}

	getSimplifiedWpVersion() {
		const wpVersion = this.getDeclaration().preferredVersions?.wp;
		if (!wpVersion || typeof wpVersion !== 'string') {
			return undefined;
		}
		if (wpVersion === 'latest' || wpVersion === 'nightly') {
			return wpVersion;
		}
		if (!VERSION_REGEX.test(wpVersion)) {
			return 'custom';
		}
		return wpVersion;
	}

	getDeclaredSteps() {
		return this.getDeclaration().steps || [];
	}

	isNetworkingEnabled() {
		return this.getDeclaration().features?.networking ?? true;
	}

	isAutologinEnabled() {
		return this.getDeclaration().login;
	}

	getLandingPage() {
		return this.getDeclaration().landingPage;
	}

	isMultisiteEnabled() {
		const steps = (this.getDeclaration().steps || []).filter(Boolean);
		return steps.some(
			(step) => step && (step as any).step === 'enableMultisite'
		);
	}

	isIntlExtensionEnabled() {
		return this.getDeclaration().features?.intl ?? false;
	}
}
