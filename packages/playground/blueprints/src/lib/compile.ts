import type { UniversalPHP } from '@php-wasm/universal';
import type { Blueprint, BlueprintBundle, BlueprintDeclaration } from './types';
import { getBlueprintDeclaration } from './reflection';
import {
	compileBlueprintV1,
	type CompileBlueprintV1Options,
	type CompiledBlueprintV1,
	isBlueprintBundle,
} from './v1/compile';
import type { BlueprintV1Declaration } from './v1/types';
import type { BlueprintV2Declaration } from './v2/blueprint-v2-declaration';

export type BlueprintExecutionPath = 'v1' | 'v2';

export type CompiledBlueprintForExecution = {
	version: 1;
	declaration: BlueprintV1Declaration;
	compiled: CompiledBlueprintV1;
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
		throw new Error(
			'Blueprint v2 execution is not supported by compileBlueprintForExecution() yet.'
		);
	}
	return compileBlueprintV1ForExecution(input, declaration, options);
}

async function compileBlueprintV1ForExecution(
	input: Blueprint | BlueprintBundle,
	declaration: BlueprintV1Declaration,
	options: CompileBlueprintForExecutionOptions
): Promise<CompiledBlueprintForExecution> {
	const compileInput =
		isBlueprintBundle(input) ? input : declaration;
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
