import type { Filesystem } from '@wp-playground/storage';
import type {
	BlueprintV1,
	BlueprintV1Declaration,
	ExtraLibrary,
	PHPConstants,
} from './v1/types';
import type {
	BlueprintV2,
	BlueprintV2Declaration,
} from './v2/blueprint-v2-declaration';
import type { SupportedPHPVersion } from '@php-wasm/universal';

/**
 * A filesystem structure containing a /blueprint.json file and any
 * resources referenced by that blueprint.
 */
export type BlueprintBundle = Filesystem;

export type BlueprintDeclaration =
	| BlueprintV1Declaration
	| BlueprintV2Declaration;
export type Blueprint = BlueprintV1 | BlueprintV2;

export interface RuntimeConfiguration {
	phpVersion: SupportedPHPVersion;
	wpVersion: string;
	intl: boolean;
	networking: boolean;
	extraLibraries: ExtraLibrary[];
	constants: PHPConstants;
}
