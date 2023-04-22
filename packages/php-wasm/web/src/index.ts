export * from './lib';

export type { SupportedPHPVersion } from '@php-wasm/abstract';
export {
	PHPRequestHandler,
	PHPBrowser,
	exposeAPI,
	consumeAPI,
	SupportedPHPVersions,
	SupportedPHPVersionsList,
	LatestSupportedPHPVersion,
} from '@php-wasm/abstract';

// Wildcard re-export is unfortunately not supported by TypeScript.
export type {
	DataModule,
	EmscriptenOptions,
	ErrnoError,
	FileInfo,
	WithFilesystem,
	RuntimeType,
	WithPHPIniBindings,
	PHPLoaderModule,
	PHPOutput,
	PHPResponse,
	PHPRunOptions,
	PHPRuntime,
	PHPRuntimeId,
	PublicAPI,
	PHPRequestHandlerConfiguration,
	PHPRequest,
	UniversalPHP,
	WorkerStartupOptions,
} from '@php-wasm/abstract';
