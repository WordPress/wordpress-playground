import { currentBackend } from './worker-thread';
import { startPHP } from 'php-wasm';
import EmscriptenDownloadMonitor from './emscripten-download-monitor';

export { currentBackend };
export { initializeWorkerThread } from './worker-thread';
export { startPHPWorkerThread, getWorkerThreadFrontend } from './worker-thread-api';
export { registerServiceWorker, initializeServiceWorker, seemsLikeAPHPServerPath } from './service-worker';
export { postMessageExpectReply, awaitReply, responseTo } from './messaging';
export { cloneResponseMonitorProgress } from './emscripten-download-monitor';

/**
 * Call this in a Worker Thread to start load the PHP runtime
 * and post the progress to the main thread.
 * 
 * @see startPHP
 * @param {Module} phpLoaderModule The ESM-wrapped Emscripten module. Consult the Dockerfile for the build process.
 * @param {Object} phpModuleArgs Optional. The Emscripten module arguments, see https://emscripten.org/docs/api_reference/module.html#affecting-execution.
 * @param {Module[]} dataDependenciesModules. Optional. A list of the ESM-wrapped Emscripten data dependency modules.
 * @returns {PHP} PHP instance. 
 */
export async function loadPHPWithProgress(phpLoaderModule, dataDependenciesModules=[], phpArgs = {}) {
    const modules = [phpLoaderModule, ...dataDependenciesModules];

	const assetsSizes = modules.reduce((acc, module) => {
		acc[module.dependencyFilename] = module.dependenciesTotalSize;
		return acc;
	}, {});
    const downloadMonitor = new EmscriptenDownloadMonitor(assetsSizes);
    downloadMonitor.addEventListener('progress', (e) => 
    currentBackend.postMessageToParent({
            type: 'download_progress',
            ...e.detail,
        })
    );

    return await startPHP(
        phpLoaderModule,
        currentBackend.jsEnv,
        {
            ...phpArgs,
            ...downloadMonitor.phpArgs
        },
        dataDependenciesModules
    );
}

export const DEFAULT_BASE_URL = 'http://example.com';

export function getPathQueryFragment(url) {
	return url.toString().substring(url.origin.length);
}
