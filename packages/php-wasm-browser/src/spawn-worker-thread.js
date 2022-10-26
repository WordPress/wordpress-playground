import { postMessageExpectReply, awaitReply } from './messaging';
import { setURLScope, removeURLScope } from './scope';
import { getPathQueryFragment } from './';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const noop = () => {};

/**
 * @typedef {Object} WorkerThreadConfig
 * @property {Function} onDownloadProgress Optional. A function to call when a download
 * 									       progress event is received from the worker
 */

/**
 * Spawns a new Worker Thread.
 * 
 * @property {string} backendName The Worker Thread backend to use. Either 'webworker' or 'iframe'.
 * @property {string} workerScriptUrl The absolute URL of the worker script.
 * @param {WorkerThreadConfig} config 
 * @returns {SpawnedWorkerThread} The spawned Worker Thread.
 */
export async function spawnPHPWorkerThread(backendName, workerScriptUrl, {
	onDownloadProgress = noop,
}) {
	let messageChannel;
	if (backendName === 'webworker') {
		messageChannel = spawnWebWorker(workerScriptUrl);
	} else if (backendName === 'iframe') {
		messageChannel = spawnIframeWorker(workerScriptUrl);
	} else {
		throw new Error(`Unknown backendName: ${backendName}`);
	}
	
	messageChannel.setMessageListener((e) => {
		if (e.data.type === 'download_progress') {
			onDownloadProgress(e.data);
		}
	});

	// Keep asking if the worker is alive until we get a response
	while (true) {
		try {
			await messageChannel.sendMessage({ type: 'is_alive' }, 50);
			break;
		} catch (e) {
			// Ignore timeouts
		}
		await sleep(50);
	}

	const absoluteUrl = await messageChannel.sendMessage({
		type: 'get_absolute_url'
	});

	return new SpawnedWorkerThread(messageChannel, absoluteUrl);
}

class SpawnedWorkerThread {

	constructor(messageChannel, serverUrl) {
		this.messageChannel = messageChannel;
		this.serverUrl = serverUrl;
	}

	/**
	 * Converts a path to an absolute URL based at the PHPServer
	 * root.
	 * 
	 * @param {string} path The server path to convert to an absolute URL.
	 * @returns {string} The absolute URL.
	 */
	pathToInternalUrl(path) {
		return `${this.serverUrl}${path}`;
	}

	/**
	 * Converts an absolute URL based at the PHPServer to a relative path
	 * without the server pathname and scope.
	 * 
	 * @param {string} internalUrl An absolute URL based at the PHPServer root.
	 * @returns {string} The relative path.
	 */
	internalUrlToPath(internalUrl) {
		return getPathQueryFragment(removeURLScope(new URL(internalUrl)));
	}

	/**
	 * Runs PHP code.
	 * 
	 * @param {string} code The PHP code to run.
	 * @returns {Promise<Output>} The result of the PHP code.
	 */
	async eval(code) {
		return await this.messageChannel.sendMessage({
			type: 'run_php',
			code,
		});
	}

	/**
	 * Dispatches a request to the PHPServer.
	 * 
	 * @param {Request} request The request to dispatch.
	 * @returns {Promise<Response>} The response from the PHPServer.
	 */
	async HTTPRequest(request) {
		return await this.messageChannel.sendMessage({
			type: 'request',
			request,
		});
	}
}

/**
 * @typedef {import('php-wasm/src/php').Output} Output
 */
/**
 * @typedef {import('php-wasm/src/php-server').Request} Request
 */
/**
 * @typedef {import('php-wasm/src/php-server').Response} Response
 */

function spawnWebWorker(workerURL) {
	const worker = new Worker(workerURL);
	return {
		async sendMessage(message, timeout) {
			const requestId = postMessageExpectReply(worker, message);
			const response = await awaitReply(worker, requestId, timeout);
			return response;
		},
		setMessageListener(listener) {
			worker.onmessage = listener;
		},
	};
}

function spawnIframeWorker(workerDocumentURL) {
	const iframe = document.createElement('iframe');
	iframe.src = workerDocumentURL;
	iframe.style.display = 'none';
	document.body.appendChild(iframe);
	return {
		async sendMessage(message, timeout) {
			const requestId = postMessageExpectReply(
				iframe.contentWindow,
				message,
				'*'
			);
			const response = await awaitReply(window, requestId, timeout);
			return response;
		},
		setMessageListener(listener) {
			window.addEventListener(
				'message',
				(e) => {
					if (e.source === iframe.contentWindow) {
						listener(e);
					}
				},
				false
			);
		},
	};
}
