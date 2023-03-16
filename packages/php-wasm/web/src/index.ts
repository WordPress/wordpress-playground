export * from './lib';

export { PHP, PHPServer, PHPBrowser, exposeAPI, consumeAPI } from '@wordpress/php-wasm-common';

// Wildcard re-export is unfortunately not supported by TypeScript.
export type { 
    DataModule,
    EmscriptenOptions,
    ErrnoError,
    FileInfo,
    Filesystem,
    JavascriptRuntime,
    PHPIni,
    PHPLoaderModule,
    PHPOutput,
    PHPRequest,
    PHPResponse,
    PHPRuntime,
    PHPRuntimeId,
    PHPServerConfigation,
    PHPServerRequest,
    WorkerStartupOptions
} from '@wordpress/php-wasm-common';
