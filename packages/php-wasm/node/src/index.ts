import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

export * from './lib';

export { PHP, PHPServer, PHPBrowser, loadPHPRuntime } from '@wp-playground/php-wasm-common';

// Wildcard re-export is unfortunately not supported by TypeScript.
export type { 
    DataModule,
    EmscriptenOptions,
    ErrnoError,
    FileInfo,
    Filesystem,
    JavascriptRuntime,
    MountSettings,
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
} from '@wp-playground/php-wasm-common';
