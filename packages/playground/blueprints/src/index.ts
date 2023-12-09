export * from './lib/steps';
export * from './lib/steps/handlers';
export * from './lib/zip';
export { runBlueprintSteps, compileBlueprint } from './lib/compile';
export type { Blueprint } from './lib/blueprint';
export type {
	CompiledStep,
	CompiledBlueprint,
	CompileBlueprintOptions,
	OnStepCompleted,
} from './lib/compile';
export type {
	CachedResource,
	CorePluginReference,
	CorePluginResource,
	CoreThemeReference,
	CoreThemeResource,
	DecoratedResource,
	FetchResource,
	FileReference,
	LiteralReference,
	LiteralResource,
	Resource,
	ResourceOptions,
	ResourceTypes,
	SemaphoreResource,
	UrlReference,
	UrlResource,
	VFSReference,
	VFSResource,
} from './lib/resources';

/**
 * @deprecated This function is a no-op. Playground no longer uses a proxy to download plugins and themes.
 *             To be removed in v0.3.0
 */
export function setPluginProxyURL() {}
