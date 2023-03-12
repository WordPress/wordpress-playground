/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="WebWorker" />

declare const self: WorkerGlobalScope;
declare const window: any; // For the web backend
/* eslint-disable no-inner-declarations */

import { startPHP } from '../../php-library/index';
import type { PHP } from '../../php-library/index';
import EmscriptenDownloadMonitor from '../emscripten-download-monitor';
import type { DownloadProgressEvent } from '../emscripten-download-monitor';
export * from '../../php-library/scope';
// import { setupTransferHandlers } from '../../php-library/transfer-handlers';

// setupTransferHandlers();

export const jsEnv = (function () {
	if (typeof window !== 'undefined') {
		return 'WEB';
	} else if (
		typeof WorkerGlobalScope !== 'undefined' &&
		self instanceof WorkerGlobalScope
	) {
		return 'WORKER';
	}
	throw new Error(`Unsupported environment`);
})();

// Read the query string startup options
export const startupOptions: Record<string, string> = {};
const params = new URL(self.location.href).searchParams;
params.forEach((value, key) => {
	startupOptions[key] = value;
});

export function materializedProxy(object: any) {
	const proto = Object.getPrototypeOf(object);
	const props = Object.getOwnPropertyNames(proto);
	const proxy = {};
	for (const prop of props) {
		if (typeof object[prop] === 'function') {
			proxy[prop] = (...args) => object[prop](...args);
		} else {
			proxy[prop] = object[prop];
		}
	}
	return proxy;
}


type ProgressListener = (progressDetails: any) => void;
const progressListeners: ProgressListener[] = [];
export function addProgressListener(
	progressHandler: ProgressListener
) {
	progressListeners.push(progressHandler);
}

/**
 * Call this in a Worker Thread to start load the PHP runtime
 * and post the progress to the main thread.
 *
 * @see startPHP
 * @param  phpLoaderModule         The ESM-wrapped Emscripten module. Consult the Dockerfile for the build process.
 * @param  dataDependenciesModules A list of the ESM-wrapped Emscripten data dependency modules.
 * @param  phpModuleArgs           The Emscripten module arguments, see https://emscripten.org/docs/api_reference/module.html#affecting-execution.
 * @returns PHP instance.
 */
export async function loadPHP(
	phpLoaderModule: any,
	dataDependenciesModules: any[] = [],
	phpModuleArgs: any = {}
): Promise<PHP> {
	const downloadMonitor = EmscriptenDownloadMonitor.forModules([
		phpLoaderModule,
		...dataDependenciesModules
	]);
	(downloadMonitor as any).addEventListener(
		'progress',
		(e: CustomEvent<DownloadProgressEvent>) => {
			progressListeners.forEach((listener) => listener(e.detail));
		}
	);

	return await startPHP(
		phpLoaderModule,
		jsEnv,
		{
			...phpModuleArgs,
			...downloadMonitor.phpArgs,
		},
		dataDependenciesModules
	);
}
