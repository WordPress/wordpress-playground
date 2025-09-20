import type { Filesystem } from '@wp-playground/storage';
import type {
	BlueprintV1,
	BlueprintV1Declaration,
	ExtraLibrary,
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
	/** The requested versions of PHP and WordPress for the blueprint */
	preferredVersions: {
		php: SupportedPHPVersion;
		wp: string;
	};
	features: {
		intl: boolean;
		/** Should boot with support for network request via wp_safe_remote_get? */
		networking: boolean;
	};
	extraLibraries: ExtraLibrary[];
}
