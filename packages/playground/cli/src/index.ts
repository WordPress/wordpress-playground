// Preserve the published module surface. Explicit Wasmtime exports below take
// precedence over the legacy worker implementation's equivalents.
export * from './run-cli';

export {
	internalsKeyForTesting,
	LogVerbosity,
	parseOptionsAndRunCLI,
	resolveWorkerCount,
	runCLI,
} from './wasmtime-run-cli';
export type {
	RunCLIServer,
	WasmtimeBlueprintV1Declaration,
	WasmtimePlaygroundFacade,
	WasmtimeRunCLIArgs,
	WasmtimeRunCLIArgs as RunCLIArgs,
	WasmtimeServer,
	WorkerType,
} from './wasmtime-run-cli';
