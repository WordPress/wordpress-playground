import { currentBackend } from './worker-thread';
import { startPHP } from 'php-wasm';
import EmscriptenDownloadMonitor from './emscripten-download-monitor';

export { currentBackend };
export { initializeWorkerThread } from './worker-thread';
export { startPHPWorkerThread, getWorkerThreadFrontend } from './worker-thread-api';
export { registerServiceWorker, initializeServiceWorker, seemsLikeAPHPServerPath } from './service-worker';
export { postMessageExpectReply, awaitReply, responseTo, messageHandler, postMessageHandler } from './messaging';
export { cloneResponseMonitorProgress } from './emscripten-download-monitor';

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
