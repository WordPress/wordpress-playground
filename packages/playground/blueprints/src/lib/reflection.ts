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

export async function getBlueprintDeclaration(
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

	getDeclaration() {
		return this.details.declaration;
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

	getBlueprint(): Blueprint {
		return this.getBundle() || this.getDeclaration();
	}

	abstract setPhpVersionString(
		phpVersion: SupportedPHPVersion | 'latest'
	): void;
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
	abstract setWpVersionString(wpVersion: string | 'latest'): void;
	abstract setNetworkingEnabled(networking: boolean): void;
	abstract isNetworkingEnabled(): boolean;
	abstract setIntlExtensionEnabled(intl: boolean): void;
	abstract isIntlExtensionEnabled(): boolean;
	abstract setLogin(
		login: boolean | { username: string; password: string } | undefined
	): void;
	abstract getLogin():
		| boolean
		| { username: string; password: string }
		| undefined;
	abstract setLandingPage(landingPage: string | undefined): void;
	abstract getLandingPage(): string | undefined;
	abstract setMultisite(enabled: boolean): void;
	abstract getMultisite(): boolean;
	abstract getDeclaredSteps(): any[];
}

const VERSION_REGEX = new RegExp(
	`^\\s*(\\d+)(?:\\.(\\d+))?(?:\\.(\\d+))?(?:[.\\-]?([a-zA-Z]+)(\\d*))?(?:[.\\-]src)?(?:[.\\-](\\d+))?\\s*$`
);

export class BlueprintV1Reflection extends BlueprintReflection<BlueprintDeclaration> {
	resolvePhpVersionString() {
		return this.getDeclaration().preferredVersions?.php;
	}

	setPhpVersionString(phpVersion: SupportedPHPVersion | 'latest') {
		const declaration = this.getDeclaration();
		this.setDeclaration({
			...declaration,
			preferredVersions: {
				wp: declaration.preferredVersions?.wp || 'latest',
				php: phpVersion as any,
			},
		});
	}

	getSimplifiedWpVersion() {
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

	setWpVersionString(wpVersion: string | 'latest') {
		const declaration = this.getDeclaration();
		this.setDeclaration({
			...declaration,
			preferredVersions: {
				wp: wpVersion as any,
				php: declaration.preferredVersions?.php || 'latest',
			},
		});
	}

	getDeclaredSteps() {
		return this.getDeclaration().steps || [];
	}

	setNetworkingEnabled(networking: boolean) {
		const declaration = this.getDeclaration();
		this.setDeclaration({
			...declaration,
			features: { ...declaration.features, networking },
		});
	}

	isNetworkingEnabled() {
		return this.getDeclaration().features?.networking || true;
	}

	setLogin(
		login:
			| boolean
			| {
					username: string;
					password: string;
			  }
			| undefined
	) {
		const declaration = this.getDeclaration();
		this.setDeclaration({
			...declaration,
			login: login as any,
		});
	}

	getLogin() {
		return this.getDeclaration().login as any;
	}

	setLandingPage(landingPage: string | undefined) {
		const declaration = this.getDeclaration();
		this.setDeclaration({
			...declaration,
			landingPage,
		});
	}

	getLandingPage() {
		return this.getDeclaration().landingPage;
	}

	setMultisite(enabled: boolean) {
		const declaration = this.getDeclaration();
		const currentSteps = (declaration.steps || []).filter(Boolean) as any[];
		const hasMultisite = currentSteps.some(
			(step) => step && (step as any).step === 'enableMultisite'
		);
		let nextSteps = currentSteps;
		if (enabled && !hasMultisite) {
			nextSteps = [...currentSteps, { step: 'enableMultisite' }];
		} else if (!enabled && hasMultisite) {
			nextSteps = currentSteps.filter(
				(step) => !(step && (step as any).step === 'enableMultisite')
			);
		}
		this.setDeclaration({
			...declaration,
			steps: nextSteps as any,
		});
	}

	getMultisite() {
		const steps = (this.getDeclaration().steps || []).filter(
			Boolean
		) as any[];
		return steps.some(
			(step) => step && (step as any).step === 'enableMultisite'
		);
	}

	isIntlExtensionEnabled() {
		return this.getDeclaration().features?.intl ?? false;
	}

	setIntlExtensionEnabled(intl: boolean) {
		const declaration = this.getDeclaration();
		this.setDeclaration({
			...declaration,
			features: { ...declaration.features, intl },
		});
	}
}
