import { ProgressTracker } from '@php-wasm/progress';
import type { UniversalPHP } from '@php-wasm/universal';
import type {
	BlueprintV2Declaration,
	CompiledBlueprintV2,
	CompiledV2Step,
	CompileBlueprintV2Options,
	V2RuntimeConfig,
	V2VersionConstraint,
	StepExecutionContext,
} from '../types';
import {
	BlueprintV2StepExecutionError,
	InvalidBlueprintV2Error,
} from '../types';
import type { DataReferenceResolverConfig } from '../data-references/types';
import { DataReferenceResolverImpl } from '../data-references/resolver';
import { v2StepHandlers } from '../steps/index';
import { validateBlueprintV2 } from './validate';
import { transpileDeclarativeToSteps } from './transpile-declarative';

/**
 * Compiles a V2 blueprint declaration into an executable form.
 *
 * This is the main entry point for V2 blueprint processing.
 * It validates the blueprint, extracts runtime configuration,
 * transpiles declarative properties into ordered steps, and
 * returns an object whose run() method executes the blueprint.
 */
export async function compileBlueprintV2(
	blueprint: BlueprintV2Declaration,
	options: CompileBlueprintV2Options = {}
): Promise<CompiledBlueprintV2> {
	const validation = validateBlueprintV2(blueprint);
	if (!validation.valid) {
		throw new InvalidBlueprintV2Error(
			'Blueprint validation failed: ' + validation.errors.join('; '),
			validation.errors
		);
	}

	// TODO: Task 25 — detect V1 and transpile to V2

	const runtimeConfig = extractRuntimeConfig(blueprint);
	const steps = transpileDeclarativeToSteps(blueprint);

	return {
		runtimeConfig,
		steps,
		run: async (playground: UniversalPHP) => {
			await executeSteps(playground, steps, options);
		},
	};
}

/**
 * Extracts runtime configuration from a V2 blueprint declaration.
 *
 * Converts phpVersion / wordpressVersion strings into
 * `V2VersionConstraint` objects and passes applicationOptions
 * through as-is.
 */
export function extractRuntimeConfig(
	blueprint: BlueprintV2Declaration
): V2RuntimeConfig {
	const config: V2RuntimeConfig = {};

	if (blueprint.phpVersion !== undefined) {
		config.phpVersion = toVersionConstraint(blueprint.phpVersion);
	}

	if (blueprint.wordpressVersion !== undefined) {
		config.wordpressVersion = toVersionConstraint(
			blueprint.wordpressVersion
		);
	}

	if (blueprint.applicationOptions !== undefined) {
		config.applicationOptions = blueprint.applicationOptions;
	}

	return config;
}

/**
 * Normalizes a version field into a `V2VersionConstraint`.
 *
 * - Plain strings (e.g. `"8.1"`, `"latest"`) become
 *   `{ preferred: "<value>" }`.
 * - Objects that look like version constraints are mapped
 *   field-by-field, using `preferred` or `recommended` as
 *   the preferred key.
 * - Other values (e.g. DataReferences like URLs) are not
 *   representable as a version constraint and are ignored.
 */
function toVersionConstraint(value: unknown): V2VersionConstraint | undefined {
	if (typeof value === 'string') {
		return { preferred: value };
	}

	if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
		const obj = value as Record<string, unknown>;
		const constraint: V2VersionConstraint = {};
		if (typeof obj.min === 'string') {
			constraint.min = obj.min;
		}
		if (typeof obj.max === 'string') {
			constraint.max = obj.max;
		}
		// The PHP schema uses "recommended"; WordPress uses
		// "preferred". Accept both.
		if (typeof obj.preferred === 'string') {
			constraint.preferred = obj.preferred;
		} else if (typeof obj.recommended === 'string') {
			constraint.preferred = obj.recommended;
		}
		return constraint;
	}

	// DataReference values (URLs, paths, etc.) cannot be
	// represented as a simple version constraint — return
	// undefined so the caller knows no constraint was set.
	return undefined;
}

/**
 * Executes an ordered list of compiled steps against a PHP
 * runtime. Each step is dispatched to its registered handler.
 * Progress reporting, data reference resolution, and error
 * wrapping are handled automatically.
 */
async function executeSteps(
	playground: UniversalPHP,
	steps: CompiledV2Step[],
	options: CompileBlueprintV2Options
): Promise<void> {
	const resolverConfig: DataReferenceResolverConfig = {
		semaphore: options.semaphore,
		corsProxy: options.corsProxy,
		executionContext: options.executionContext,
	};
	const resolver = new DataReferenceResolverImpl(resolverConfig);

	const context: StepExecutionContext = {
		php: playground,
		progress: options.progress ?? new ProgressTracker(),
		dataReferenceResolver: resolver,
	};

	for (let i = 0; i < steps.length; i++) {
		const step = steps[i];
		const handler = v2StepHandlers[step.step];

		if (!handler) {
			throw new BlueprintV2StepExecutionError(
				step.step,
				`Unknown step handler: "${step.step}"`
			);
		}

		try {
			if (step.progressHints?.caption) {
				context.progress.setCaption(step.progressHints.caption);
			}
			await handler(step.args, context);
			options.onStepCompleted?.(step.step, i);
		} catch (error) {
			if (error instanceof BlueprintV2StepExecutionError) {
				throw error;
			}
			throw new BlueprintV2StepExecutionError(
				step.step,
				`Step "${step.step}" (index ${i}) failed: ${
					error instanceof Error ? error.message : String(error)
				}`,
				error
			);
		}
	}
}
