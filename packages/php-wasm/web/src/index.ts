export * from './lib';

export { PHP, PHPServer, PHPBrowser, exposeAPI, consumeAPI } from '@wp-playground/php-wasm-common';

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
    PHPServerConfigation,
    PHPServerRequest,
    WorkerStartupOptions
} from '@wp-playground/php-wasm-common';
