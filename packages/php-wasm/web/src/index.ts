export * from './lib';

export type { SupportedPHPVersion } from '@php-wasm/common';
export {
	PHPRequestHandler,
	PHPBrowser,
	exposeAPI,
	consumeAPI,
	jsToPHPTranslator,
	SupportedPHPVersions,
	SupportedPHPVersionsList,
	LatestSupportedPHPVersion,
} from '@php-wasm/common';

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
	WorkerStartupOptions,
} from '@php-wasm/common';
