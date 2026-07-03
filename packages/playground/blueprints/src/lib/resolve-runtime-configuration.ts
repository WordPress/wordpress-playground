import { AllPHPVersions, type AllPHPVersion } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { BlueprintReflection } from './reflection';
import type {
	Blueprint,
	BlueprintDeclaration,
	RuntimeConfiguration,
} from './types';
import { compileBlueprintV1 } from './v1/compile';
import type { BlueprintV1 } from './v1/types';
import type { BlueprintV2Declaration } from './v2/blueprint-v2-declaration';

export async function resolveRuntimeConfiguration(
	blueprint: Blueprint
): Promise<RuntimeConfiguration> {
	const reflection = await BlueprintReflection.create(blueprint);
	if (reflection.getVersion() === 1) {
		const compiledBlueprint = await compileBlueprintV1(
			blueprint as BlueprintV1
		);

		return {
			wpVersion: compiledBlueprint.versions.wp,
			phpVersion: compiledBlueprint.versions.php,
			intl: compiledBlueprint.features.intl,
			networking: compiledBlueprint.features.networking,
			extraLibraries: compiledBlueprint.extraLibraries,
			/*
			 * Constants don't matter so much for temporary sites so let's
			 * use an empty object here. We can't easily figure out which
			 * additional constants were applied via playground.defineConstant()
			 * at this stage anyway.
			 *
			 * This property is only relevant for stored sites to ensure they're
			 * consistently applied across page reloads.
			 */
			constants: {},
		};
	} else {
		const declaration = reflection.getDeclaration();
		if (!isBlueprintV2Declaration(declaration)) {
			throw new Error('Expected a Blueprint v2 declaration.');
		}
		const playgroundOptions =
			declaration.applicationOptions?.['wordpress-playground'];

		// @TODO: actually compute the runtime configuration based on the resolved Blueprint v2
		return {
			phpVersion: resolveV2PHPVersion(declaration),
			wpVersion: 'latest',
			intl: false,
			networking: playgroundOptions?.networkAccess ?? true,
			constants: {},
			extraLibraries: [],
		};
	}
}

function isBlueprintV2Declaration(
	declaration: BlueprintDeclaration
): declaration is BlueprintV2Declaration {
	return (declaration as { version?: unknown }).version === 2;
}

function resolveV2PHPVersion(
	declaration: BlueprintV2Declaration
): AllPHPVersion {
	if (typeof declaration.phpVersion !== 'string') {
		return RecommendedPHPVersion;
	}

	if (
		(AllPHPVersions as readonly string[]).includes(declaration.phpVersion)
	) {
		return declaration.phpVersion as AllPHPVersion;
	}

	throw new Error(
		`Unsupported Blueprint v2 PHP version "${declaration.phpVersion}". ` +
			`Supported versions: ${AllPHPVersions.join(', ')}.`
	);
}
