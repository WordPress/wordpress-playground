import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

export * from './lib';

export {
	LatestSupportedPHPVersion,
	PHPBrowser,
	SupportedPHPVersions,
	SupportedPHPVersionsList,
} from '@php-wasm/common';

// Wildcard re-export of type is unfortunately unsupported by TypeScript.
export type {
	DataModule,
	EmscriptenOptions,
	ErrnoError,
	FileInfo,
	MountSettings,
	PHPLoaderModule,
	PHPOutput,
	PHPRequest,
	PHPResponse,
	PHPRuntime,
	PHPRuntimeId,
	PHPRequestHandlerConfiguration,
	RuntimeType,
	SupportedPHPVersion,
	WithFilesystem,
	WithPHPIniBindings,
	WorkerStartupOptions,
} from '@php-wasm/common';
