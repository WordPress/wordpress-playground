import type { UniversalPHP } from '@php-wasm/universal';
import type {
	Blueprint,
	BlueprintBundle,
	BlueprintDeclaration,
	RuntimeConfiguration,
} from './types';
import { getBlueprintDeclaration } from './reflection';
import { resolveRuntimeConfiguration } from './resolve-runtime-configuration';
import {
	compileBlueprintV1,
	type CompileBlueprintV1Options,
	type CompiledBlueprintV1,
	isBlueprintBundle,
} from './v1/compile';
import type { BlueprintV1Declaration } from './v1/types';
import type { BlueprintV2Declaration } from './v2/blueprint-v2-declaration';
import { runBlueprintV2 } from './v2/run-blueprint-v2';

export type BlueprintExecutionPath = 'v1' | 'v2';

type CompiledBlueprintV2 = {
	runtime: RuntimeConfiguration;
	run: (playground: UniversalPHP) => Promise<void>;
};

export type CompiledBlueprintForExecution =
	| {
			version: 1;
			declaration: BlueprintV1Declaration;
			compiled: CompiledBlueprintV1;
			run: (playground: UniversalPHP) => Promise<void>;
	  }
	| {
			version: 2;
			declaration: BlueprintV2Declaration;
			compiled: CompiledBlueprintV2;
			run: (playground: UniversalPHP) => Promise<void>;
	  };

export interface CompileBlueprintForExecutionOptions extends Omit<
	CompileBlueprintV1Options,
	'onBlueprintValidated' | 'streamBundledFile'
> {
	onBlueprintValidated?: (blueprint: BlueprintDeclaration) => void;
}

/**
 * Compiles a Blueprint into the shape consumers need before execution.
 *
 * The legacy `compileBlueprint()` export intentionally remains v1-only for
 * backwards compatibility. This helper is the version-aware entrypoint that
 * newer callers can migrate to as Blueprint v2 support grows.
 */
export async function compileBlueprintForExecution(
	input: Blueprint | BlueprintBundle,
	options: CompileBlueprintForExecutionOptions = {}
): Promise<CompiledBlueprintForExecution> {
	const declaration = await getBlueprintDeclaration(input);
	if (isBlueprintV2Declaration(declaration)) {
		return compileBlueprintV2ForExecution(input, declaration);
	}
	return compileBlueprintV1ForExecution(input, declaration, options);
}

async function compileBlueprintV2ForExecution(
	input: Blueprint | BlueprintBundle,
	declaration: BlueprintV2Declaration
): Promise<CompiledBlueprintForExecution> {
	if (isBlueprintBundle(input)) {
		throw new Error(
			'Blueprint v2 bundles are not supported by compileBlueprintForExecution() yet.'
		);
	}
	const runtime = await resolveRuntimeConfiguration(declaration);
	const compiled = {
		runtime,
		run: async (playground: UniversalPHP) => {
			await runBlueprintV2({
				php: playground,
				blueprint: declaration,
			});
		},
	};
	return {
		version: 2,
		declaration,
		compiled,
		run: compiled.run,
	};
}

async function compileBlueprintV1ForExecution(
	input: Blueprint | BlueprintBundle,
	declaration: BlueprintV1Declaration,
	options: CompileBlueprintForExecutionOptions
): Promise<CompiledBlueprintForExecution> {
	const compileInput = isBlueprintBundle(input) ? input : declaration;
	const compiled = await compileBlueprintV1(compileInput, {
		...options,
		onBlueprintValidated: options.onBlueprintValidated as
			| CompileBlueprintV1Options['onBlueprintValidated']
			| undefined,
	});
	return {
		version: 1,
		declaration,
		compiled,
		run: compiled.run,
	};
}

function isBlueprintV2Declaration(
	declaration: BlueprintDeclaration
): declaration is BlueprintV2Declaration {
	return (declaration as { version?: unknown }).version === 2;
}
