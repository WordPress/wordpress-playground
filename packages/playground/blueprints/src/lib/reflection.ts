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

export class BlueprintReflection {
	private readonly declaration:
		| BlueprintV1Declaration
		| BlueprintV2Declaration;
	private readonly bundle: BlueprintBundle | undefined;
	private readonly version: number;

	static async create(blueprint: Blueprint) {
		const declaration = await getBlueprintDeclaration(blueprint);
		const bundle = isBlueprintBundle(blueprint) ? blueprint : undefined;
		return BlueprintReflection.createFromDeclaration(declaration, bundle);
	}

	static createFromDeclaration(
		declaration: BlueprintV1Declaration | BlueprintV2Declaration,
		bundle: BlueprintBundle | undefined = undefined
	) {
		return new BlueprintReflection(
			declaration,
			bundle,
			(declaration as any).version || 1
		);
	}

	protected constructor(
		declaration: BlueprintV1Declaration | BlueprintV2Declaration,
		bundle: BlueprintBundle | undefined,
		version: number
	) {
		this.declaration = declaration;
		this.bundle = bundle;
		this.version = version;
	}

	getVersion() {
		return this.version;
	}

	getDeclaration() {
		return this.declaration;
	}

	isBundle() {
		return this.bundle !== undefined;
	}

	getBundle() {
		return this.bundle;
	}

	getBlueprint(): Blueprint {
		return this.getBundle() || this.getDeclaration();
	}
}
