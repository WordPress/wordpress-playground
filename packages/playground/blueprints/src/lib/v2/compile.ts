import type { UniversalPHP } from '@php-wasm/universal';
import type { RuntimeConfiguration } from '../types';
import { resolveRuntimeConfiguration } from '../resolve-runtime-configuration';
import type { BlueprintV2Declaration } from './blueprint-v2-declaration';

export class UnsupportedBlueprintV2FeatureError extends Error {
	public readonly featurePath: string;

	constructor(featurePath: string) {
		super(
			`${featurePath}: This Blueprint v2 feature is not supported by the TypeScript runner yet.`
		);
		this.name = 'UnsupportedBlueprintV2FeatureError';
		this.featurePath = featurePath;
	}
}

export type CompiledBlueprintV2 = {
	runtime: RuntimeConfiguration;
	run: (playground: UniversalPHP) => Promise<void>;
};

export async function compileBlueprintV2(
	declaration: BlueprintV2Declaration
): Promise<CompiledBlueprintV2> {
	assertSupportedBlueprintV2Declaration(declaration);
	const runtime = await resolveRuntimeConfiguration(declaration);
	return {
		runtime,
		run: async () => {},
	};
}

function assertSupportedBlueprintV2Declaration(
	declaration: BlueprintV2Declaration
) {
	for (const property of UNSUPPORTED_EXECUTION_PROPERTIES) {
		if (property in declaration) {
			throw new UnsupportedBlueprintV2FeatureError(property);
		}
	}

	const playgroundOptions =
		declaration.applicationOptions?.['wordpress-playground'];
	if (
		playgroundOptions &&
		('landingPage' in playgroundOptions || 'login' in playgroundOptions)
	) {
		throw new UnsupportedBlueprintV2FeatureError(
			'applicationOptions.wordpress-playground'
		);
	}
}

const UNSUPPORTED_EXECUTION_PROPERTIES = [
	'siteLanguage',
	'siteOptions',
	'constants',
	'activeTheme',
	'themes',
	'plugins',
	'muPlugins',
	'postTypes',
	'fonts',
	'media',
	'content',
	'users',
	'roles',
	'additionalStepsAfterExecution',
] as const;
