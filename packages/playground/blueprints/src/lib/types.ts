import { Filesystem } from '@wp-playground/storage';
import { BlueprintV2 } from './v2/wep-1-blueprint-v2-schema/appendix-A-blueprint-v2-schema';
import { BlueprintV1, BlueprintV1Declaration } from './v1/types';
import { BlueprintV2Declaration } from './v2/blueprint-v2-declaration';

/**
 * A filesystem structure containing a /blueprint.json file and any
 * resources referenced by that blueprint.
 */
export type BlueprintBundle = Filesystem;

export type BlueprintDeclaration =
	| BlueprintV1Declaration
	| BlueprintV2Declaration;
export type Blueprint = BlueprintV1 | BlueprintV2;
