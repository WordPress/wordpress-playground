import type { UniversalPHP } from '@php-wasm/universal';
import type { BlueprintDeclaration } from './types';
import {
	compileBlueprintV1,
	type CompileBlueprintV1Options,
	type CompiledBlueprintV1,
} from './v1/compile';
import type { BlueprintV1Declaration } from './v1/types';

export type BlueprintExecutionPath = 'v1';

export type CompiledBlueprintForExecution = {
	version: 1;
	declaration: BlueprintV1Declaration;
	compiled: CompiledBlueprintV1;
	run: (playground: UniversalPHP) => Promise<void>;
};

export interface CompileBlueprintForExecutionOptions
	extends Omit<
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
	declaration: BlueprintV1Declaration,
	options: CompileBlueprintForExecutionOptions = {}
): Promise<CompiledBlueprintForExecution> {
	const compiled = await compileBlueprintV1(declaration, {
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
