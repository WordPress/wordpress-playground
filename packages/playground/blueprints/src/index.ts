export type {
	BlueprintV1,
	BlueprintV1Declaration,
	PHPConstants,
	ExtraLibrary,
} from './lib/v1/types';
export type {
	Blueprint,
	BlueprintBundle,
	BlueprintDeclaration,
	RuntimeConfiguration,
} from './lib/types';
export { BlueprintReflection } from './lib/reflection';
export { compileBlueprintForExecution } from './lib/compile';
export type {
	BlueprintExecutionPath,
	CompiledBlueprintForExecution,
	CompileBlueprintForExecutionOptions,
} from './lib/compile';
export {
	getBlueprintDeclaration,
	isBlueprintBundle,
	compileBlueprintV1,
	runBlueprintV1Steps,
	InvalidBlueprintError,
	BlueprintStepExecutionError,
	validateBlueprint,

	// BC:
	compileBlueprintV1 as compileBlueprint,
	runBlueprintV1Steps as runBlueprintSteps,
	isStepDefinition,
} from './lib/v1/compile';
export type {
	CompileBlueprintV1Options,
	CompiledBlueprintV1,
	CompiledV1Step,
	OnStepCompleted,
	BlueprintValidationResult,
} from './lib/v1/compile';
export type {
	CachedResource,
	CorePluginReference,
	CorePluginResource,
	CoreThemeReference,
	CoreThemeResource,
	FetchResource,
	FileReference,
	LiteralReference,
	LiteralResource,
	Resource,
	ResourceDecorator,
	ResourceTypes,
	SemaphoreResource,
	UrlReference,
	UrlResource,
	VFSReference,
	VFSResource,
} from './lib/v1/resources';
export {
	BlueprintFilesystemRequiredError,
	ResourceDownloadError,
} from './lib/v1/resources';
export * from './lib/steps';
export * from './lib/steps/handlers';
export type {
	BlueprintV2,
	BlueprintV2Declaration,
	RawBlueprintV2Data,
	ParsedBlueprintV1orV2String as ParsedBlueprintV2String,
} from './lib/v2/blueprint-v2-declaration';
export { getV2Runner } from './lib/v2/get-v2-runner';
export { runBlueprintV2 } from './lib/v2/run-blueprint-v2';
export type { BlueprintMessage } from './lib/v2/run-blueprint-v2';
export {
	blueprintV2ToBlueprintV1,
	compileBlueprintV2,
	createBlueprintV2ExecutionPlan,
	getBlueprintV2Declaration,
	hasBlueprintV2WordPressZipReference,
	resolveBlueprintV2RuntimeConfiguration,
	resolveBlueprintV2WordPressSource,
	runBlueprintV2Steps,
	upgradeBlueprintV1ToV2,
	validateBlueprintV2,
	InvalidBlueprintV2Error,
	UnsupportedBlueprintV2FeatureError,
} from './lib/v2/compile';
export type {
	BlueprintV2ValidationError,
	BlueprintV2ValidationResult,
	CompileBlueprintV2Options,
	CompiledBlueprintV2,
	ResolvedBlueprintV2WordPressSource,
} from './lib/v2/compile';

export {
	resolveRemoteBlueprint,
	BlueprintFetchError,
} from './lib/resolve-remote-blueprint';
export type { ResolveRemoteBlueprintOptions } from './lib/resolve-remote-blueprint';
export { wpContentFilesExcludedFromExport } from './lib/utils/wp-content-files-excluded-from-exports';
export { resolveRuntimeConfiguration } from './lib/resolve-runtime-configuration';

/**
 * @deprecated This function is a no-op. Playground no longer uses a proxy to download plugins and themes.
 *             To be removed in v0.3.0
 */
export function setPluginProxyURL() {}
