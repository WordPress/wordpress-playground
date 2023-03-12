export { PHP, loadPHPRuntime } from './php';
export type {
	PHPOutput,
	PHPRequest,
	PHPResponse,
	JavascriptRuntime,
    ErrnoError,
    DataModule,
    PHPLoaderModule,
    PHPRuntime,
    PHPRuntimeId,
    EmscriptenOptions,
    MountSettings
} from './php';

export { toRelativeUrl } from './urls';

export * from './comlink-utils';
export type * from './comlink-utils';

import PHPServer from './php-server';
export { PHPServer };
export type { PHPServerConfigation, PHPServerRequest } from './php-server';

import PHPBrowser from './php-browser';
export { PHPBrowser };

export async function getPHPLoaderModule(version = '8.2') {
    switch (version) {
        case '8.2':
            // @ts-ignore
            return await import('../php/php-8.2.js');
        case '8.1':
            // @ts-ignore
            return await import('../php/php-8.1.js');
        case '8.0':
            // @ts-ignore
            return await import('../php/php-8.0.js');
        case '7.4':
            // @ts-ignore
            return await import('../php/php-7.4.js');
        case '7.3':
            // @ts-ignore
            return await import('../php/php-7.3.js');
        case '7.2':
            // @ts-ignore
            return await import('../php/php-7.2.js');
        case '7.1':
            // @ts-ignore
            return await import('../php/php-7.1.js');
        case '7.0':
            // @ts-ignore
            return await import('../php/php-7.0.js');
        case '5.6':
            // @ts-ignore
            return await import('../php/php-5.6.js');
    }
    throw new Error(`Unsupported PHP version ${version}`);
}

export type StartupOptions = Record<string, string>;
export function parseWorkerStartupOptions(): StartupOptions {
	// Read the query string startup options
	if (typeof self?.location?.href !== 'undefined') {
		// Web
		const startupOptions: StartupOptions = {};
		const params = new URL(self.location.href).searchParams;
		params.forEach((value, key) => {
			startupOptions[key] = value;
		});
		return startupOptions;
	} else {
		// Node.js
		return JSON.parse(process.env.WORKER_OPTIONS || '{}');
	}
}
