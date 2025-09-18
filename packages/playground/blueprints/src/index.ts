// Blueprints require WordPress Playground's Node polyfills.
import '@php-wasm/node-polyfills';

export type {
	Blueprint,
	BlueprintBundle,
	BlueprintDeclaration,
	PHPConstants,
} from './lib/v1/types';
export {
	compileBlueprint,
	getBlueprintDeclaration,
	isBlueprintBundle,
	runBlueprintSteps,
} from './lib/v1/compile';
export type {
	CompileBlueprintOptions,
	CompiledBlueprint,
	CompiledStep,
	OnStepCompleted,
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
export * from './lib/steps';
export * from './lib/steps/handlers';
export type {
	BlueprintV2Declaration,
	ParsedBlueprintV2Declaration,
} from './lib/v2/blueprint-v2-declaration';
export { getV2Runner } from './lib/v2/get-v2-runner';
export { runBlueprintV2 } from './lib/v2/run-blueprint-v2';
export type { BlueprintMessage } from './lib/v2/run-blueprint-v2';

export { resolveRemoteBlueprint } from './lib/resolve-remote-blueprint';
export { wpContentFilesExcludedFromExport } from './lib/utils/wp-content-files-excluded-from-exports';

/**
 * @deprecated This function is a no-op. Playground no longer uses a proxy to download plugins and themes.
 *             To be removed in v0.3.0
 */
export function setPluginProxyURL() {}
