import type { SupportedPHPVersion } from '@php-wasm/universal';
import { InMemoryFilesystem, OverlayFilesystem } from '@wp-playground/storage';
import type { Blueprint, BlueprintBundle } from './types';
import type { BlueprintV1Declaration } from './v1/types';
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

	abstract setPhpVersion(phpVersion: SupportedPHPVersion | 'latest'): void;
	abstract getPhpVersion(): SupportedPHPVersion | 'latest' | undefined;
	abstract setWpVersion(wpVersion: string | 'latest'): void;
	abstract getWpVersion(): string | 'latest' | undefined;
	abstract setNetworking(networking: boolean): void;
	abstract getNetworking(): boolean;
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

export class BlueprintV1Reflection extends BlueprintReflection<BlueprintV1Declaration> {
	getPhpVersion() {
		return this.getDeclaration().preferredVersions?.php;
	}

	setPhpVersion(phpVersion: SupportedPHPVersion | 'latest') {
		const declaration = this.getDeclaration();
		this.setDeclaration({
			...declaration,
			preferredVersions: {
				wp: declaration.preferredVersions?.wp || 'latest',
				php: phpVersion as any,
			},
		});
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

	setWpVersion(wpVersion: string | 'latest') {
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

	setNetworking(networking: boolean) {
		const declaration = this.getDeclaration();
		this.setDeclaration({
			...declaration,
			features: { ...declaration.features, networking },
		});
	}

	getNetworking() {
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

	getIntl() {
		return this.getDeclaration().features?.intl ?? false;
	}

	setIntl(intl: boolean) {
		const declaration = this.getDeclaration();
		this.setDeclaration({
			...declaration,
			features: { ...declaration.features, intl },
		});
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

	setPhpVersion(phpVersion: SupportedPHPVersion | 'latest') {
		const declaration = this.getDeclaration();
		this.setDeclaration({
			...declaration,
			phpVersion: phpVersion as any,
		});
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

	setWpVersion(wpVersion: string | 'latest') {
		const declaration = this.getDeclaration();
		this.setDeclaration({
			...declaration,
			wordpressVersion: wpVersion as any,
		});
	}

	getDeclaredSteps() {
		return this.getDeclaration().additionalStepsAfterExecution || [];
	}

	setNetworking(networking: boolean) {
		const declaration = this.getDeclaration();
		this.setDeclaration({
			...declaration,
			applicationOptions: {
				'wordpress-playground': {
					...declaration.applicationOptions?.['wordpress-playground'],
					networkAccess: networking,
				},
			},
		});
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

	setIntl(intl: boolean) {
		const declaration = this.getDeclaration();
		this.setDeclaration({
			...declaration,
			applicationOptions: {
				...(declaration.applicationOptions || {}),
				'wordpress-playground': {
					...(declaration.applicationOptions?.[
						'wordpress-playground'
					] || {}),
					intlExtension: intl,
				} as any,
			},
		});
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
			applicationOptions: {
				...(declaration.applicationOptions || {}),
				'wordpress-playground': {
					...(declaration.applicationOptions?.[
						'wordpress-playground'
					] || {}),
					login: login as any,
				},
			},
		});
	}

	getLogin() {
		return this.getDeclaration().applicationOptions?.[
			'wordpress-playground'
		]?.login as any;
	}

	setLandingPage(landingPage: string | undefined) {
		const declaration = this.getDeclaration();
		this.setDeclaration({
			...declaration,
			applicationOptions: {
				...(declaration.applicationOptions || {}),
				'wordpress-playground': {
					...(declaration.applicationOptions?.[
						'wordpress-playground'
					] || {}),
					landingPage,
				},
			},
		});
	}

	getLandingPage() {
		return this.getDeclaration().applicationOptions?.[
			'wordpress-playground'
		]?.landingPage;
	}

	setMultisite(enabled: boolean) {
		const declaration = this.getDeclaration();
		const currentSteps = (
			declaration.additionalStepsAfterExecution || []
		).filter(Boolean) as any[];
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
			additionalStepsAfterExecution: nextSteps as any,
		});
	}

	getMultisite() {
		const steps = (
			this.getDeclaration().additionalStepsAfterExecution || []
		).filter(Boolean) as any[];
		return steps.some(
			(step) => step && (step as any).step === 'enableMultisite'
		);
	}
}
