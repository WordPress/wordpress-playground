import type { BlueprintBundle } from '../types';
import type { V2Schema } from './wep-1-blueprint-v2-schema/appendix-A-blueprint-v2-schema';

type BlueprintV2Declaration = V2Schema.BlueprintV2;
export type BlueprintV2 = BlueprintV2Declaration | BlueprintBundle;

export type { BlueprintV2Declaration };
