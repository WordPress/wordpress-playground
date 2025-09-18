import type { Filesystem } from '@wp-playground/storage';
import type { V2Schema } from './v2/wep-1-blueprint-v2-schema/appendix-A-blueprint-v2-schema';
import type { BlueprintV1, BlueprintV1Declaration } from './v1/types';
import type { RawBlueprintV2Data } from './v2/blueprint-v2-declaration';

/**
 * A filesystem structure containing a /blueprint.json file and any
 * resources referenced by that blueprint.
 */
export type BlueprintBundle = Filesystem;

export type BlueprintDeclaration = BlueprintV1Declaration | RawBlueprintV2Data;
export type Blueprint = BlueprintV1 | V2Schema.BlueprintV2;
