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
export type { RunCLIServer, WorkerType } from './wasmtime-run-cli';
