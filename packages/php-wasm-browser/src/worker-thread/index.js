/* eslint-disable no-inner-declarations */

import { startPHP, PHPBrowser, PHPServer } from 'php-wasm';
import { responseTo, messageHandler } from '../messaging';
import { DEFAULT_BASE_URL } from '../urls';
import environment from './environment';
export { environment };
import DownloadMonitor from '../download-monitor';

const noop = () => {};
export async function initializeWorkerThread(bootBrowser=defaultBootBrowser) {
	// Handle postMessage communication from the main thread
	environment.setMessageListener(
		messageHandler(handleMessage)
	);

	let phpBrowser;
	async function handleMessage(message) {
		if (message.type === 'initialize_php') {
			phpBrowser = await bootBrowser({
				absoluteUrl: message.absoluteUrl
			});
		}
		else if (message.type === 'is_alive') {
			return true;
		}
		else if (message.type === 'run_php') {
			return await phpBrowser.server.php.run(message.code);
		}
		else if (message.type === 'request') {
			const parsedUrl = new URL(
				message.request.path,
				DEFAULT_BASE_URL
			);
			return await phpBrowser.request({
				...message.request,
				path: parsedUrl.pathname,
				queryString: parsedUrl.search,
			});
		} else {
			console.warn(
				`[WASM Worker] "${message.type}" event received but it has no handler.`
			);
		}
	}
}

async function defaultBootBrowser({ absoluteUrl }) {
	return new PHPBrowser(
		new PHPServer(
			await PHP.create('/php.js', phpArgs),
			{
				absoluteUrl: absoluteUrl || location.origin
			}
		)
	)
}

export async function loadPHPWithProgress(phpLoaderModule, dataDependenciesModules=[], phpArgs = {}) {
    const modules = [phpLoaderModule, ...dataDependenciesModules];

	const assetsSizes = modules.reduce((acc, module) => {
		acc[module.dependencyFilename] = module.dependenciesTotalSize;
		return acc;
	}, {});
    const downloadMonitor = new DownloadMonitor(assetsSizes);
    downloadMonitor.addEventListener('progress', (e) => 
        environment.postMessageToParent({
            type: 'download_progress',
            ...e.detail,
        })
    );

    return await startPHP(
        phpLoaderModule,
        environment.name,
        {
            ...phpArgs,
            ...downloadMonitor.phpArgs
        },
        dataDependenciesModules
    );
}
