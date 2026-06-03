import type { UniversalPHP } from '@php-wasm/universal';
import { BlueprintReflection } from './reflection';
import type {
	Blueprint,
	BlueprintBundle,
	BlueprintDeclaration,
} from './types';
import {
	compileBlueprintV1,
	isBlueprintBundle,
	type CompileBlueprintV1Options,
	type CompiledBlueprintV1,
} from './v1/compile';
import type { BlueprintV1Declaration, StreamBundledFile } from './v1/types';
import {
	compileBlueprintV2,
	type CompileBlueprintV2Options,
	type CompiledBlueprintV2,
} from './v2/compile';
import type {
	BlueprintV2,
	BlueprintV2Declaration,
	RawBlueprintV2Data,
} from './v2/blueprint-v2-declaration';

/**
 * Selects which declaration compiler should normalize the input before
 * execution.
 *
 * Callers usually omit this and let the declaration version decide. Migration
 * callers can force `v2` to upgrade legacy v1 declarations through the new
 * compiler while keeping the same worker/runtime path.
 */
export type BlueprintExecutionPath = 'v1' | 'v2';
type BlueprintExecutionInput =
	| Blueprint
	| BlueprintBundle
	| BlueprintV2
	| RawBlueprintV2Data;

/**
 * A compiled Blueprint plus the normalized declaration used to boot runtime.
 *
 * Browser and CLI callers need the declaration before executing steps so they
 * can resolve PHP/WordPress versions and download WordPress from the correct
 * source.
 */
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

export interface CompileBlueprintForExecutionOptions
	extends Omit<
		CompileBlueprintV1Options,
		'onBlueprintValidated' | 'streamBundledFile'
	> {
	/**
	 * Overrides automatic version detection when a caller intentionally runs a
	 * declaration through a specific compiler.
	 */
	executionPath?: BlueprintExecutionPath;
	streamBundledFile?: StreamBundledFile;
	onBlueprintValidated?: (blueprint: BlueprintDeclaration) => void;
}

/**
 * Compiles a Blueprint using the execution path appropriate for its version.
 *
 * The legacy `compileBlueprint()` export intentionally remains v1-only for
 * backwards compatibility. This helper is the version-aware entrypoint for
 * callers that support both Blueprint declaration formats.
 */
export async function compileBlueprintForExecution(
	input: BlueprintExecutionInput,
	options: CompileBlueprintForExecutionOptions = {}
): Promise<CompiledBlueprintForExecution> {
	const { executionPath, ...compileOptions } = options;
	const resolvedExecutionPath =
		executionPath || (await getBlueprintExecutionPath(input));

	if (resolvedExecutionPath === 'v2') {
		const compiled = await compileBlueprintV2(input as any, {
			...compileOptions,
			onBlueprintValidated: options.onBlueprintValidated as
				| CompileBlueprintV2Options['onBlueprintValidated']
				| undefined,
		});
		return {
			version: 2,
			declaration: compiled.declaration,
			compiled,
			run: compiled.run,
		};
	}

	const declaration = await getBlueprintV1Declaration(input);
	const compileInput = isBlueprintBundle(input) ? input : declaration;
	const compiled = await compileBlueprintV1(compileInput, {
		...compileOptions,
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

async function getBlueprintExecutionPath(
	blueprint: BlueprintExecutionInput
): Promise<BlueprintExecutionPath> {
	if (blueprint === undefined) {
		// Let v2 validation report the malformed input for callers migrating to
		// the version-aware facade. V1 has its own compatibility entrypoint.
		return 'v2';
	}
	if (typeof blueprint === 'string') {
		const declaration = JSON.parse(blueprint);
		return declaration?.version === 2 ? 'v2' : 'v1';
	}
	const reflection = await BlueprintReflection.create(blueprint);
	return reflection.getVersion() === 2 ? 'v2' : 'v1';
}

async function getBlueprintV1Declaration(
	blueprint: BlueprintExecutionInput
): Promise<BlueprintV1Declaration> {
	if (blueprint === undefined) {
		throw new Error('Invalid Blueprint v1: expected a JSON object.');
	}
	if (typeof blueprint === 'string') {
		return JSON.parse(blueprint) as BlueprintV1Declaration;
	}
	const reflection = await BlueprintReflection.create(blueprint);
	return reflection.getDeclaration() as BlueprintV1Declaration;
}
