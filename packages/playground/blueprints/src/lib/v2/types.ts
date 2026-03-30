import type { ProgressTracker } from '@php-wasm/progress';
import type { UniversalPHP } from '@php-wasm/universal';
import type { Semaphore } from '@php-wasm/util';
import type { V2Schema } from './wep-1-blueprint-v2-schema/appendix-A-blueprint-v2-schema';
import type { DataSources } from './wep-1-blueprint-v2-schema/appendix-B-data-sources';

// =====================================================================
// Blueprint V2 Declaration (re-export from schema)
// =====================================================================

/**
 * The raw Blueprint V2 declaration as authored by users in
 * blueprint.json files, directly reflecting the V2 JSON schema.
 */
export type BlueprintV2Declaration = V2Schema.BlueprintV2;

// =====================================================================
// Compiled Blueprint V2
// =====================================================================

/**
 * A Blueprint V2 that has been compiled from a declaration into
 * an executable form. Compilation resolves version constraints,
 * transpiles declarative properties into step sequences, and
 * validates the schema.
 */
export interface CompiledBlueprintV2 {
	/** Runtime configuration extracted from the declaration. */
	runtimeConfig: V2RuntimeConfig;
	/** Ordered list of compiled steps ready for execution. */
	steps: CompiledV2Step[];
	/**
	 * Executes the compiled blueprint against a PHP instance.
	 *
	 * @param php - The PHP runtime to execute against.
	 * @param options - Optional execution parameters.
	 */
	run(
		php: UniversalPHP,
		options?: CompiledBlueprintV2RunOptions
	): Promise<void>;
}

/**
 * Options accepted by `CompiledBlueprintV2.run()`.
 */
export interface CompiledBlueprintV2RunOptions {
	/** Progress tracker for reporting execution progress. */
	progress?: ProgressTracker;
	/** Abort signal for cancelling execution. */
	signal?: AbortSignal;
}

// =====================================================================
// Runtime Configuration
// =====================================================================

/**
 * Runtime configuration derived from a V2 Blueprint declaration.
 * Contains version constraints and application-level options that
 * the host environment uses to set up PHP and WordPress before
 * step execution begins.
 */
export interface V2RuntimeConfig {
	/** PHP version constraint, if specified. */
	phpVersion?: V2VersionConstraint;
	/** WordPress version constraint, if specified. */
	wordpressVersion?: V2VersionConstraint;
	/**
	 * Application-specific options from the blueprint's
	 * `applicationOptions` property. Keyed by application
	 * name (e.g. `"wordpress-playground"`).
	 */
	applicationOptions?: BlueprintV2Declaration['applicationOptions'];
}

/**
 * A semver-style version constraint supporting min/max bounds
 * and a preferred version.
 */
export interface V2VersionConstraint {
	/** Minimum acceptable version (inclusive). */
	min?: string;
	/** Maximum acceptable version (inclusive). */
	max?: string;
	/**
	 * Preferred version to use when the host has a choice.
	 * Falls back to "latest" when unspecified.
	 */
	preferred?: string;
}

// =====================================================================
// Compiled Steps
// =====================================================================

/**
 * A single step that has been compiled from either a declarative
 * blueprint property (e.g. `plugins`) or from an explicit
 * `additionalStepsAfterExecution` entry.
 */
export interface CompiledV2Step {
	/** The step handler name (e.g. "installPlugin"). */
	step: string;
	/**
	 * The resolved arguments for the step handler. The shape
	 * depends on the specific step type.
	 */
	args: Record<string, unknown>;
	/**
	 * Optional hints for the progress tracker, such as a
	 * human-readable caption and relative weight.
	 */
	progressHints?: StepProgressHints;
}

/**
 * Hints that the compiler attaches to a compiled step so that
 * the execution loop can report meaningful progress.
 */
export interface StepProgressHints {
	/**
	 * Human-readable caption displayed during execution
	 * (e.g. "Installing Jetpack plugin").
	 */
	caption?: string;
	/**
	 * Relative weight of this step for progress calculation.
	 * Higher values indicate longer-running steps.
	 * @default 1
	 */
	weight?: number;
}

// =====================================================================
// Step Execution Context
// =====================================================================

/**
 * The context passed to every step handler during execution.
 * Provides access to the PHP runtime, progress reporting, data
 * resolution, and cancellation.
 */
export interface StepExecutionContext {
	/** The PHP runtime to execute against. */
	php: UniversalPHP;
	/** Progress tracker scoped to the current step. */
	progress: ProgressTracker;
	/** Resolver for data references (URLs, paths, inline). */
	dataReferenceResolver: DataReferenceResolver;
	/** Abort signal for cooperative cancellation. */
	signal?: AbortSignal;
}

// =====================================================================
// Data Reference Resolution
// =====================================================================

/**
 * Resolves V2 data references into concrete file/directory
 * contents. Data references can be URLs, execution-context
 * paths, inline content, or git repository paths.
 */
export interface DataReferenceResolver {
	/**
	 * Resolves a data reference to a single file.
	 *
	 * @param ref - A V2 data reference (URL, path, inline, etc.)
	 * @returns The resolved file contents.
	 */
	resolveFile(ref: DataSources.DataReference): Promise<ResolvedFile>;

	/**
	 * Resolves a data reference to a directory tree.
	 *
	 * @param ref - A V2 data reference pointing to a directory.
	 * @returns The resolved directory structure.
	 */
	resolveDirectory(
		ref: DataSources.DataReference
	): Promise<ResolvedDirectory>;
}

/**
 * A resolved file: a name and its binary contents.
 */
export interface ResolvedFile {
	/** The file name (without directory path). */
	name: string;
	/** The file contents as a byte array. */
	contents: Uint8Array;
}

/**
 * A resolved directory containing files and subdirectories.
 */
export interface ResolvedDirectory {
	/** The directory name. */
	name: string;
	/**
	 * Entries in this directory, keyed by name. Leaf entries
	 * are `Uint8Array` (files), nested entries are
	 * `ResolvedDirectory`.
	 */
	files: Record<string, Uint8Array | ResolvedDirectory>;
}

// =====================================================================
// Step Handler
// =====================================================================

/**
 * A function that executes a single V2 blueprint step.
 *
 * Step handlers are registered in the step handler registry
 * and dispatched by the execution loop based on the step name.
 *
 * @typeParam TArgs - The shape of the step's arguments.
 */
export type V2StepHandler<TArgs = Record<string, unknown>> = (
	args: TArgs,
	context: StepExecutionContext
) => Promise<void>;

// =====================================================================
// Compilation Options
// =====================================================================

/**
 * Backend interface providing read access to the blueprint's
 * execution context (the directory where blueprint.json lives
 * and any co-located resources).
 */
export interface ExecutionContextBackend {
	/**
	 * Reads a file from the execution context as raw bytes.
	 *
	 * @param path - Path relative to the execution context root.
	 */
	readFileAsBuffer(path: string): Promise<Uint8Array>;

	/**
	 * Lists files in a directory within the execution context.
	 *
	 * @param path - Path relative to the execution context root.
	 * @returns An array of file/directory names.
	 */
	listFiles(path: string): Promise<string[]>;
}

/**
 * Options for `compileBlueprintV2()`.
 */
export interface CompileBlueprintV2Options {
	/** Progress tracker for reporting execution progress. */
	progress?: ProgressTracker;
	/** Concurrency limiter for parallel downloads. */
	semaphore?: Semaphore;
	/** CORS proxy URL prefix for cross-origin fetches. */
	corsProxy?: string;
	/**
	 * Execution context backend for resolving paths starting
	 * with "./" or "/" in data references.
	 */
	executionContext?: ExecutionContextBackend;
	/** Called after each step finishes executing. */
	onStepCompleted?: (step: string, index: number) => void;
}

// =====================================================================
// Error Classes
// =====================================================================

/**
 * Thrown when a V2 Blueprint declaration fails schema validation
 * or contains structurally invalid data.
 */
export class InvalidBlueprintV2Error extends Error {
	/** Detailed validation errors, if available. */
	validationErrors: string[];

	constructor(message: string, validationErrors: string[] = []) {
		super(message);
		this.name = 'InvalidBlueprintV2Error';
		this.validationErrors = validationErrors;
	}
}

/**
 * Thrown when a V2 Blueprint step fails during execution.
 */
export class BlueprintV2StepExecutionError extends Error {
	/** The name of the step that failed. */
	stepName: string;

	constructor(stepName: string, message: string, cause?: unknown) {
		super(message, { cause });
		this.name = 'BlueprintV2StepExecutionError';
		this.stepName = stepName;
	}
}

/**
 * Thrown when a data reference cannot be resolved (e.g. a URL
 * that returns 404 or an execution-context path that does not
 * exist).
 */
export class DataReferenceResolutionError extends Error {
	/** String representation of the reference that failed. */
	reference: string;

	constructor(reference: string, message: string, cause?: unknown) {
		super(message, { cause });
		this.name = 'DataReferenceResolutionError';
		this.reference = reference;
	}
}

/**
 * Thrown when two blueprints cannot be merged because of
 * conflicting declarations that have no automatic resolution
 * strategy (e.g. incompatible PHP version constraints).
 */
export class BlueprintMergeConflictError extends Error {
	/** The blueprint property where the conflict occurred. */
	conflictPath: string;

	constructor(conflictPath: string, message: string) {
		super(message);
		this.name = 'BlueprintMergeConflictError';
		this.conflictPath = conflictPath;
	}
}
