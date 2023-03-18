export * from './lib';

export {
	PHP,
	PHPServer,
	PHPBrowser,
	exposeAPI,
	consumeAPI,
} from '@php-wasm/common';

// Wildcard re-export is unfortunately not supported by TypeScript.
export type {
	DataModule,
	EmscriptenOptions,
	ErrnoError,
	FileInfo,
	WithFilesystem,
	JavascriptRuntime,
	WithPHPIniBindings,
	PHPLoaderModule,
	PHPOutput,
	PHPRequest,
	PHPResponse,
	PHPRuntime,
	PHPRuntimeId,
	PublicAPI,
	PHPServerConfigation,
	PHPServerRequest,
	WorkerStartupOptions,
} from '@php-wasm/common';
