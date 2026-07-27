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
export { validateBlueprintDeclaration } from './lib/validate-blueprint-declaration';
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
} from './lib/v2/blueprint-v2-declaration';
export {
	compileBlueprintV2,
	createBlueprintV2ExecutionPlan,
	resolveBlueprintV2WordPressSource,
} from './lib/v2/compile';
export type {
	CompiledBlueprintV2,
	CompileBlueprintV2Options,
	ResolveBlueprintV2WordPressSourceOptions,
} from './lib/v2/compile';

export {
	resolveRemoteBlueprint,
	BlueprintFetchError,
} from './lib/resolve-remote-blueprint';
export type { ResolveRemoteBlueprintOptions } from './lib/resolve-remote-blueprint';
export { getLegacyPlaygroundRuntimeWpContentPaths } from './lib/utils/legacy-playground-runtime-wp-content-paths';
export { resolveRuntimeConfiguration } from './lib/resolve-runtime-configuration';
export type { ResolveRuntimeConfigurationOptions } from './lib/resolve-runtime-configuration';
export { assertBlueprintV2WordPressVersionCompatibility } from './lib/v2/resolve-runtime-configuration';
export type { BlueprintV2SiteMode } from './lib/v2/resolve-runtime-configuration';
export { compileBlueprintForExecution } from './lib/compile';
export type {
	BlueprintExecutionPath,
	CompiledBlueprintForExecution,
	CompileBlueprintForExecutionOptions,
} from './lib/compile';

/**
 * @deprecated This function is a no-op. Playground no longer uses a proxy to download plugins and themes.
 *             To be removed in v0.3.0
 */
export function setPluginProxyURL() {}
