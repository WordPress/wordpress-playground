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

const V2_WORDPRESS_VERSION_LABELS = ['latest', 'beta', 'trunk', 'nightly'];
const V2_WORDPRESS_VERSION_PATTERN =
	/^\d+\.\d+(?:\.\d+)?(?:-(?:beta|rc)\d+)?$/i;

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
			wpVersion: resolveV2WordPressVersion(declaration),
			intl: false,
			networking: playgroundOptions?.networkAccess ?? true,
			constants: declaration.constants ?? {},
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

function resolveV2WordPressVersion(
	declaration: BlueprintV2Declaration
): string {
	const wordpressVersion = declaration.wordpressVersion;
	if (typeof wordpressVersion === 'string') {
		return resolveV2WordPressVersionString(wordpressVersion);
	}

	const preferredVersion =
		getV2WordPressConstraintPreferredVersion(wordpressVersion);
	if (preferredVersion) {
		return resolveV2WordPressVersionString(preferredVersion);
	}

	return 'latest';
}

function resolveV2WordPressVersionString(wordpressVersion: string): string {
	if (
		V2_WORDPRESS_VERSION_LABELS.includes(wordpressVersion) ||
		V2_WORDPRESS_VERSION_PATTERN.test(wordpressVersion)
	) {
		return wordpressVersion;
	}

	throw new Error(
		`Unsupported Blueprint v2 WordPress version "${wordpressVersion}". ` +
			'Use latest, beta, trunk, nightly, or a version like 6.8, 6.8.1, or 6.8-rc1.'
	);
}

function getV2WordPressConstraintPreferredVersion(
	wordpressVersion: BlueprintV2Declaration['wordpressVersion']
): string | undefined {
	if (!wordpressVersion || typeof wordpressVersion !== 'object') {
		return undefined;
	}
	if (!('min' in wordpressVersion)) {
		return undefined;
	}
	if (!('preferred' in wordpressVersion)) {
		return undefined;
	}
	return typeof wordpressVersion.preferred === 'string'
		? wordpressVersion.preferred
		: undefined;
}
