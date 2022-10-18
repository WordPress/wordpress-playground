import {
	postMessageExpectReply,
	awaitReply,
	responseTo,
	DEFAULT_REPLY_TIMEOUT,
} from '../shared/messaging.mjs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const noop = () => {};

export async function runWordPress({
	wasmWorkerBackend,
	wasmWorkerUrl,
	wordPressSiteUrl,
	serviceWorkerUrl,
	assignScope = true,
	onWasmDownloadProgress,
}) {
	assertNotInfiniteLoadingLoop();

	const scope = assignScope ? Math.random().toFixed(16) : undefined;

	const wasmWorker = await createWordPressWorker({
		backend: getWorkerBackend(wasmWorkerBackend, wasmWorkerUrl),
		wordPressSiteUrl,
		scope,
		onDownloadProgress: onWasmDownloadProgress,
	});
	await registerServiceWorker({
		url: serviceWorkerUrl,
		// Forward any HTTP requests to a worker to resolve them in another process.
		// This way they won't slow down the UI interactions.
		onRequest: async (request) => {
			return await wasmWorker.HTTPRequest(request);
		},
		scope,
	});
	return wasmWorker;
}

/**
 * When the service worker fails for any reason, the page displayed inside
 * the iframe won't be a WordPress instance we expect from the service worker.
 * Instead, it will be the original page trying to load the service worker. This
 * causes an infinite loop with a loader inside a loader inside a loader.
 */
function assertNotInfiniteLoadingLoop() {
	let isBrowserInABrowser = false;
	try {
		isBrowserInABrowser =
			window.parent !== window && window.parent.IS_WASM_WORDPRESS;
	} catch (e) {}
	if (isBrowserInABrowser) {
		throw new Error(
			'The service worker did not load correctly. This is a bug, please report it on https://github.com/WordPress/wordpress-wasm/issues'
		);
	}
	window.IS_WASM_WORDPRESS = true;
}

// <SERVICE WORKER>
// Register the service worker and handle any HTTP WordPress requests it provides us:
export async function registerServiceWorker({ url, onRequest, scope }) {
	if (!navigator.serviceWorker) {
		// eslint-disable-next-line no-alert
		alert('Service workers are not supported in this browser.');
		throw new Error('Service workers are not supported in this browser.');
	}
	await navigator.serviceWorker.register(url);
	const serviceWorkerChannel = new BroadcastChannel(
		`wordpress-service-worker`
	);
	serviceWorkerChannel.addEventListener(
		'message',
		async function onMessage(event) {
			/**
			 * Ignore events meant for other WordPress instances to
			 * avoid handling the same event twice.
			 *
			 * This is important because BroadcastChannel transmits
			 * events to all the listeners across all browser tabs.
			 */
			if (scope && event.data.scope !== scope) {
				return;
			}
			console.debug(
				`[Main] "${event.data.type}" message received from a service worker`
			);

			let result;
			if (
				event.data.type === 'request' ||
				event.data.type === 'httpRequest'
			) {
				result = await onRequest(event.data.request);
			} else {
				throw new Error(
					`[Main] Unexpected message received from the service-worker: "${event.data.type}"`
				);
			}

			// The service worker expects a response when it includes a `messageId` in the message:
			if (event.data.messageId) {
				serviceWorkerChannel.postMessage(
					responseTo(event.data.messageId, result)
				);
			}
			console.debug(`[Main] "${event.data.type}" message processed`, {
				result,
			});
		}
	);
	navigator.serviceWorker.startMessages();

	// Without sleep(0), the request below always returns 404.
	// @TODO: Figure out why.
	await sleep(0);

	const wordPressBaseUrl = setURLScope(new URL(url).origin, scope).toString();
	const response = await fetch(`${wordPressBaseUrl}/wp-admin/atomlib.php`);
	if (!response.ok) {
		// The service worker did not claim this page for some reason. Let's reload.
		window.location.reload();
	}
}
// </SERVICE WORKER>

// <WASM WORKER>
export async function createWordPressWorker({
	backend,
	wordPressSiteUrl,
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
	 * Scoping a WordPress instances means hosting it on a
	 * path starting with `/scope:`. This helps WASM workers
	 * avoid rendering any requests meant for other WASM workers.
	 *
	 * @see registerServiceWorker for more details
	 */
	wordPressSiteUrl = setURLScope(new URL(wordPressSiteUrl), scope).toString();

	backend.addMessageListener((e) => {
		if (e.data.type === 'download_progress') {
			onDownloadProgress(e.data);
		}
	});

	// Now that the worker is up and running, let's ask it to initialize
	// WordPress:
	await backend.sendMessage({
		type: 'initialize_wordpress',
		siteURL: wordPressSiteUrl,
	});

	return {
		pathToInternalUrl(wordPressPath) {
			return `${wordPressSiteUrl}${wordPressPath}`;
		},
		internalUrlToPath(internalUrl) {
			return getPathQueryFragment(removeURLScope(new URL(internalUrl)));
		},
		async HTTPRequest(request) {
			return await backend.sendMessage({
				type: 'request',
				request,
			});
		},
		async login(user = 'admin', password = 'password') {
			await this.HTTPRequest({
				path: this.pathToInternalUrl('/wp-login.php'),
			});

			await this.HTTPRequest({
				path: this.pathToInternalUrl('/wp-login.php'),
				method: 'POST',
				_POST: {
					log: user,
					pwd: password,
					rememberme: 'forever',
				},
			});
		},
	};
}

export function getWorkerBackend(key, url) {
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

// </WASM WORKER>

// <URL UTILS>
export function getPathQueryFragment(url) {
	return url.toString().substring(url.origin.length);
}

export function isURLScoped(url) {
	return url.pathname.startsWith(`/scope:`);
}

export function getURLScope(url) {
	if (isURLScoped(url)) {
		return url.pathname.split('/')[1].split(':')[1];
	}
	return null;
}

export function setURLScope(url, scope) {
	if (!scope) {
		return url;
	}
	const newUrl = new URL(url);

	if (isURLScoped(newUrl)) {
		const parts = newUrl.pathname.split('/');
		parts[1] = `scope:${scope}`;
		newUrl.pathname = parts.join('/');
	} else {
		const suffix = newUrl.pathname === '/' ? '' : newUrl.pathname;
		newUrl.pathname = `/scope:${scope}${suffix}`;
	}

	return newUrl;
}
export function removeURLScope(url) {
	if (!isURLScoped(url)) {
		return url;
	}
	const newUrl = new URL(url);
	const parts = newUrl.pathname.split('/');
	newUrl.pathname = '/' + parts.slice(2).join('/');
	return newUrl;
}

// </URL UTILS>
