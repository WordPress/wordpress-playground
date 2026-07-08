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
import { compileBlueprintV2, type CompiledBlueprintV2 } from './v2/compile';

export type BlueprintExecutionPath = 'v1' | 'v2';

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

type BlueprintExecutionInput = Blueprint | BlueprintBundle | string;

/**
 * Compiles a Blueprint into the shape consumers need before execution.
 *
 * The legacy `compileBlueprint()` export intentionally remains v1-only for
 * backwards compatibility. This helper is the version-aware entrypoint that
 * newer callers can migrate to as Blueprint v2 support grows.
 */
export async function compileBlueprintForExecution(
	input: BlueprintExecutionInput,
	options: CompileBlueprintForExecutionOptions = {}
): Promise<CompiledBlueprintForExecution> {
	const isRawJsonInput = typeof input === 'string';
	const declaration = await getBlueprintDeclaration(input);
	if (isBlueprintV2Declaration(declaration)) {
		return compileBlueprintV2ForExecution(
			isRawJsonInput ? declaration : input,
			declaration
		);
	}
	if (isRawJsonInput) {
		throw new Error(
			'Raw JSON input is only supported for Blueprint v2 declarations.'
		);
	}
	return compileBlueprintV1ForExecution(input, declaration, options);
}

async function compileBlueprintV2ForExecution(
	input: Blueprint | BlueprintBundle,
	declaration: BlueprintV2Declaration
): Promise<CompiledBlueprintForExecution> {
	const compiled = await compileBlueprintV2(
		declaration,
		isBlueprintBundle(input)
			? { streamBundledFile: (...args: [any]) => input.read(...args) }
			: {}
	);
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
