import { BlueprintV1, BlueprintV1Declaration } from './v1/types';
import { Blueprint, BlueprintBundle, BlueprintDeclaration } from './types';
import { BlueprintV2Declaration } from './v2/blueprint-v2-declaration';
import { BlueprintV2 } from './v2/wep-1-blueprint-v2-schema/appendix-A-blueprint-v2-schema';

export function isBlueprintBundle(input: any): input is BlueprintBundle {
	return input && 'read' in input && typeof input.read === 'function';
}

export async function getBlueprintDeclaration(
	blueprint: BlueprintV1
): Promise<BlueprintV1Declaration | BlueprintV2Declaration> {
	if (!isBlueprintBundle(blueprint)) {
		return blueprint;
	}
	const blueprintFile = await blueprint.read('blueprint.json');
	const blueprintText = await blueprintFile.text();
	return JSON.parse(blueprintText);
}

export class BlueprintReflection<T extends Blueprint> {
	private declaration: BlueprintDeclaration | undefined = undefined;
	constructor(public blueprint: T) {}

	isV1Declaration(): this is BlueprintReflection<BlueprintV1Declaration> {
		return !this.isV2Declaration() && !this.isBundle();
	}

	isV2Declaration(): this is BlueprintReflection<BlueprintV2Declaration> {
		return 'version' in this.blueprint && this.blueprint.version === 2;
	}

	isBundle(): this is BlueprintReflection<BlueprintBundle> {
		return (
			'read' in this.blueprint &&
			typeof this.blueprint.read === 'function'
		);
	}

	async isV1Bundle(): Promise<boolean> {
		if (!this.isBundle()) {
			return false;
		}
		const declaration = await this.getDeclaration();
		return new BlueprintReflection(declaration).isV1Declaration();
	}

	async isV2Bundle(): Promise<boolean> {
		if (!this.isBundle()) {
			return false;
		}
		const declaration = await this.getDeclaration();
		return new BlueprintReflection(declaration).isV2Declaration();
	}

	async getDeclaration(): Promise<BlueprintDeclaration> {
		if (!this.declaration) {
			if (this.isBundle()) {
				if (!isBlueprintBundle(this.blueprint)) {
					return this.blueprint;
				}
				const blueprintFile = await this.blueprint.read(
					'blueprint.json'
				);
				const blueprintText = await blueprintFile.text();
				this.declaration = JSON.parse(blueprintText);
			} else if (this.isV1Declaration()) {
				this.declaration = this.blueprint;
			} else if (this.isV2Declaration()) {
				this.declaration = this.blueprint;
			} else {
				throw new Error('Not a valid Blueprint');
			}
		}
		return this.declaration!;
	}
}
