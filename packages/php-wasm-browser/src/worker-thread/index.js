/* eslint-disable no-inner-declarations */

import { initialize } from 'esbuild';
import { PHP } from 'php-wasm';
import { phpBrowser, PHPBrowser } from 'php-wasm-web';
import { responseTo } from '../messaging';
import { DEFAULT_BASE_URL } from '../urls';
import { DownloadMonitor } from './download-monitor';§
import { getCurrentEnvironment } from './environments';

const noop = () => {};
export function initializeWorkerThread({
	assetsSizes,
	bootBrowser = ({ php }) => new PHPBrowser(new phpBrowser(php)),
	locateFile = (file) => file,
}) {
	const workerEnv = getCurrentEnvironment({
		locateFile
	});

	// Handle postMessage communication from the main thread
	const postMessageToParent = workerEnv.addMessageListener(
		messageHandler(handleMessage)
	);

	let phpBrowser;
	async function handleMessage(message) {
		if (message.type === 'initialize_php') {
			const downloadMonitor = new DownloadMonitor({ assetsSizes });
			downloadMonitor.plugIntoWebAssembly_instantiateStreaming();
			downloadMonitor.addEventListener('progress', (e) => 
				postMessageToParent({
					type: 'download_progress',
					...e.detail,
				})
			);

			const php = new PHP();
			// eslint-disable-next-line no-undef
			await workerEnv.importScripts(env.getPHPLoaderScript());
			// eslint-disable-next-line no-undef
			await php.init(PHPLoader, {
				dataFileDownloads: downloadMonitor.dataFileDownloadsProxy,
				locateFile
			});

			phpBrowser = await bootBrowser({ php, workerEnv, message });
			return true;
		}

		if (message.type === 'is_alive') {
			return true;
		}

		if (message.type === 'run_php') {
			return await phpBrowser.server.php.run(message.code);
		}

		if (message.type === 'request' || message.type === 'httpRequest') {
			const parsedUrl = new URL(
				message.request.path,
				DEFAULT_BASE_URL
			);
			return await phpBrowser.request({
				...message.request,
				path: parsedUrl.pathname,
				_GET: parsedUrl.search,
			});
		}

		console.warning(
			`[WASM Worker] "${message.type}" event received but it has no handler.`
		);
	}
}

