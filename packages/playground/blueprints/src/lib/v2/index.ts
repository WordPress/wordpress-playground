// V2 types
// Note: BlueprintV2Declaration is intentionally NOT re-exported
// here — it comes from blueprint-v2-declaration.ts to avoid
// duplicate identifier errors in DTS bundle generation.
export type {
	CompiledBlueprintV2,
	CompiledBlueprintV2RunOptions,
	CompiledV2Step,
	CompileBlueprintV2Options,
	V2RuntimeConfig,
	V2VersionConstraint,
	V2StepHandler,
	StepExecutionContext,
	StepProgressHints,
	DataReferenceResolver,
	ResolvedFile,
	ResolvedDirectory,
	ExecutionContextBackend,
} from './types';

export {
	InvalidBlueprintV2Error,
	BlueprintV2StepExecutionError,
	DataReferenceResolutionError,
	BlueprintMergeConflictError,
} from './types';

// V2 compilation
export { compileBlueprintV2 } from './compile/compile';

// V2 step handlers (for extensibility)
export { v2StepHandlers, registerV2StepHandler } from './steps/index';
