import { postMessageExpectReply, awaitReply } from './messaging.mjs';

export async function startPHPWorkerThread({
	backend,
	absoluteUrl,
	scope,
	onDownloadProgress = noop,
}) {
	// Keep asking if the worker is alive until we get a response
	while (true) {
		try {
			await backend.sendMessage({ type: 'is_alive' }, 50);
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
	absoluteUrl = setURLScope(new URL(absoluteUrl), scope).toString();

	backend.addMessageListener((e) => {
		if (e.data.type === 'download_progress') {
			onDownloadProgress(e.data);
		}
	});

	// Now that the worker thread is up and running, let's ask
	// it to initialize PHP:
	await backend.sendMessage({
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
			return await backend.sendMessage({
				type: 'run_php',
				code,
			});
		},
		async HTTPRequest(request) {
			return await backend.sendMessage({
				type: 'request',
				request,
			});
		},
	};
}

export function getWorkerThreadBackend(key, url) {
	const backends = {
		webworker: webWorkerBackend,
		shared_worker: sharedWorkerBackend,
		iframe: iframeBackend,
	};
	const backend = backends[key];
	if (!backend) {
		const availableKeys = Object.keys(backends).join(', ');
		throw new Error(
			`Unknown worker backend: "${key}". Choices: ${availableKeys}`
		);
	}
	return backend(url);
}

export function webWorkerBackend(workerURL) {
	const worker = new Worker(workerURL);
	return {
		async sendMessage(message, timeout = DEFAULT_REPLY_TIMEOUT) {
			const messageId = postMessageExpectReply(worker, message);
			const response = await awaitReply(worker, messageId, timeout);
			return response;
		},
		addMessageListener(listener) {
			worker.onmessage = listener;
		},
	};
}

export function sharedWorkerBackend(workerURL) {
	const worker = new SharedWorker(workerURL);
	worker.port.start();
	return {
		async sendMessage(message, timeout = DEFAULT_REPLY_TIMEOUT) {
			const messageId = postMessageExpectReply(worker.port, message);
			const response = await awaitReply(worker.port, messageId, timeout);
			return response;
		},
		addMessageListener(listener) {
			worker.port.onmessage = listener;
		},
	};
}

export function iframeBackend(workerDocumentURL) {
	const iframe = document.createElement('iframe');
	iframe.src = workerDocumentURL;
	iframe.style.display = 'none';
	document.body.appendChild(iframe);
	return {
		async sendMessage(message, timeout = DEFAULT_REPLY_TIMEOUT) {
			const messageId = postMessageExpectReply(
				iframe.contentWindow,
				message,
				'*'
			);
			const response = await awaitReply(window, messageId, timeout);
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
