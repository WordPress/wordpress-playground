/* eslint-disable no-inner-declarations */

import { PHP, PHPBrowser, PHPServer } from 'php-wasm';
import { responseTo, messageHandler } from '../messaging';
import { DEFAULT_BASE_URL } from '../urls';
import DownloadMonitor from './download-monitor';
import { getCurrentEnvironment } from './environments';
export { cloneResponseMonitorProgress } from './download-monitor';

const noop = () => {};
export function initializeWorkerThread({
	assetsSizes,
	bootBrowser = defaultBootBrowser
}) {
	// Handle postMessage communication from the main thread
	const postMessageToParent = getCurrentEnvironment().addMessageListener(
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

			phpBrowser = await bootBrowser({
				message,
				phpArgs: {
					dataFileDownloads: downloadMonitor.dataFileDownloadsProxy
				}
			});
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

async function defaultBootBrowser({ phpArgs, message }) {
	return new PHPBrowser(
		new PHPServer(
			await PHP.create('/php.js', phpArgs),
			{
				absoluteUrl: message.absoluteUrl
			}
		)
	)
}
