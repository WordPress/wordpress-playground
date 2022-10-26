import { postMessageExpectReply, awaitReply } from './messaging';
import { setURLScope, removeURLScope } from './scope';
import { getPathQueryFragment } from './';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const noop = () => {};

/**
 * @typedef {Object} WorkerThreadConfig
 * @property {string} frontend The frontend object to communicate with the worker thread.
 * @property {string} absoluteUrl The absolute URL used to initiate the PHPServer.
 * @property {string} scope Optional. The scope to use for this worker thread. See the 
 *                          Scopes section in the documentation for more details.
 * @property {Function} onDownloadProgress Optional. A function to call when a download
 * 									       progress event is received from the worker
 */

/**
 * Starts
 * 
 * @param {WorkerThreadConfig} config 
 * @returns 
 */
export async function initializePHPWorkerThread({
	frontend,
	absoluteUrl,
	scope,
	onDownloadProgress = noop,
}) {
	// Keep asking if the worker is alive until we get a response
	while (true) {
		try {
			await frontend.sendMessage({ type: 'is_alive' }, 50);
			break;
		} catch (e) {
			// Ignore timeouts
		}
		await sleep(50);
	}

	/**
	 * Scoping a PHP instance means hosting it on a
	 * path starting with `/scope:`. This helps WASM workers
	 * avoid rendering any requests meant for other WASM workers.
	 *
	 * @see registerServiceWorker for more details
	 */
	if (scope) {
		absoluteUrl = setURLScope(new URL(absoluteUrl), scope).toString();
	}

	frontend.addMessageListener((e) => {
		if (e.data.type === 'download_progress') {
			onDownloadProgress(e.data);
		}
	});

	// Now that the worker thread is up and running, let's ask
	// it to initialize PHP:
	await frontend.sendMessage({
		type: 'initialize_php',
		absoluteUrl: absoluteUrl,
	});

	return {
		pathToInternalUrl(path) {
			return `${absoluteUrl}${path}`;
		},
		internalUrlToPath(internalUrl) {
			return getPathQueryFragment(removeURLScope(new URL(internalUrl)));
		},
		async eval(code) {
			return await frontend.sendMessage({
				type: 'run_php',
				code,
			});
		},
		async HTTPRequest(request) {
			return await frontend.sendMessage({
				type: 'request',
				request,
			});
		},
	};
}

export function getWorkerThreadFrontend(key, url) {
	const frontends = {
		webworker: webWorkerFrontend,
		iframe: iframeFrontend,
	};
	const frontend = frontends[key];
	if (!frontend) {
		const availableKeys = Object.keys(frontends).join(', ');
		throw new Error(
			`Unknown worker frontend: "${key}". Choices: ${availableKeys}`
		);
	}
	return frontend(url);
}

export function webWorkerFrontend(workerURL) {
	const worker = new Worker(workerURL);
	return {
		async sendMessage(message, timeout) {
			const requestId = postMessageExpectReply(worker, message);
			const response = await awaitReply(worker, requestId, timeout);
			return response;
		},
		addMessageListener(listener) {
			worker.onmessage = listener;
		},
	};
}

export function iframeFrontend(workerDocumentURL) {
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
		addMessageListener(listener) {
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
