import { postMessageExpectReply, awaitReply, responseTo } from './messaging.js';
import {
	getPathQueryFragment,
	getURLScope,
	isURLScoped,
	removeURLScope,
} from './urls';

/**
 * Run this in the main application to register the service worker.
 * 
 * It will handle all the PHP HTTP requests the browser makes on
 * the domain it's registered on.
 * 
 * @param {Object} config
 */
export async function registerServiceWorker({ broadcastChannel, url, onRequest, scope }) {
	if (!broadcastChannel) {
		throw new Error('Missing the required `broadcastChannel` option.');
	}
	if (!navigator.serviceWorker) {
		throw new Error('Service workers are not supported in this browser.');
	}

	const registration = await navigator.serviceWorker.register(url);
	await registration.update();
	broadcastChannel.addEventListener(
		'message',
		async function onMessage(event) {
			/**
			 * Ignore events meant for other PHP instances to
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
				broadcastChannel.postMessage(
					responseTo(event.data.messageId, result)
				);
			}
			console.debug(`[Main] "${event.data.type}" message processed`, {
				result,
			});
		}
	);
	navigator.serviceWorker.startMessages();
}

/**
 * Run this in the service worker to install the required event handlers.
 * 
 * @param {Object} config
 */
export function initializeServiceWorker({
	broadcastChannel,
	shouldHandleRequest=isPHPFile
}) {
	if (!broadcastChannel) {
		throw new Error('Missing the required `broadcastChannel` option.');
	}

	/**
	 * Ensure the client gets claimed by this service worker right after the registration.
	 *
	 * Only requests from the "controlled" pages are resolved via the fetch listener below.
	 * However, simply registering the worker is not enough to make it the "controller" of
	 * the current page. The user still has to reload the page. If they don't an iframe
	 * pointing to /index.php will show a 404 message instead of a homepage.
	 *
	 * This activation handles saves the user reloading the page after the initial confusion.
	 * It immediately makes this worker the controller of any client that registers it.
	 */
	self.addEventListener('activate', (event) => {
		// eslint-disable-next-line no-undef
		event.waitUntil(clients.claim());
	});

	/**
	 * The main method. It captures the requests and loop them back to the main
	 * application using the Loopback request
	 */
	self.addEventListener('fetch', (event) => {
		const url = new URL(event.request.url);

		/**
		 * Detect scoped requests – their url starts with `/scope:`
		 *
		 * We need this mechanics because BroadcastChannel transmits
		 * events to all the listeners across all browser tabs. Scopes
		 * helps WASM workers ignore requests meant for other WASM workers.
		 */
		const scope = getURLScope(url);
		const unscopedUrl = removeURLScope(url);

		if (!shouldHandleRequest(unscopedUrl)) {
			// When ignoring a scoped request, let's unscope it before
			// passing it to the browser.
			if (isURLScoped(url)) {
				event.preventDefault();
				return event.respondWith(
					new Promise(async (accept) => {
						const newRequest = await cloneRequest(event.request, {
							url: unscopedUrl,
						});
						accept(fetch(newRequest));
					})
				);
			}
			// Otherwise let the browser handle the request as is.
			return;
		}

		event.preventDefault();
		return event.respondWith(
			new Promise(async (accept) => {
				console.log(
					`[ServiceWorker] Serving request: ${getPathQueryFragment(
						unscopedUrl
					)}`
				);

				const { post, files } = await parsePost(event.request);
				const requestHeaders = {};
				for (const pair of event.request.headers.entries()) {
					requestHeaders[pair[0]] = pair[1];
				}

				const requestedPath = getPathQueryFragment(url);
				let phpResponse;
				try {
					const message = {
						type: 'httpRequest',
						scope,
						request: {
							path: requestedPath,
							method: event.request.method,
							files,
							_POST: post,
							headers: requestHeaders,
						},
					};
					console.log(
						'[ServiceWorker] Forwarding a request to the main app',
						{
							message,
						}
					);
					const messageId = postMessageExpectReply(
						broadcastChannel,
						message
					);
					phpResponse = await awaitReply(broadcastChannel, messageId);
					console.log(
						'[ServiceWorker] Response received from the main app',
						{
							phpResponse,
						}
					);
				} catch (e) {
					console.error(e, { requestedPath });
					throw e;
				}

				accept(
					new Response(phpResponse.body, {
						headers: phpResponse.headers,
						status: phpResponse.statusCode
					})
				);
			})
		);
	});
}

export function isPHPFile(path) {
	return path.endsWith('/') || path.endsWith('.php');
}

async function parsePost(request) {
	if (request.method !== 'POST') {
		return { post: undefined, files: undefined };
	}
	// Try to parse the body as form data
	try {
		const formData = await request.clone().formData();
		const post = {};
		const files = {};

		for (const key of formData.keys()) {
			const value = formData.get(key);
			if (value instanceof File) {
				files[key] = value;
			} else {
				post[key] = value;
			}
		}

		return { post, files };
	} catch (e) {}

	// Try to parse the body as JSON
	return { post: await request.clone().json(), files: {} };
}

/**
 * Copy a request with custom overrides.
 *
 * This function is only needed because Request properties
 * are read-only. The only way to change e.g. a URL is to
 * create an entirely new request:
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/Request
 *
 * @param {Request} request
 * @param {Object}  overrides
 * @return {Request} The new request.
 */
 async function cloneRequest(request, overrides) {
	const body =
		['GET', 'HEAD'].includes(request.method) || 'body' in overrides
			? undefined
			: await request.blob();
	return new Request(overrides.url || request.url, {
		body,
		method: request.method,
		headers: request.headers,
		referrer: request.referrer,
		referrerPolicy: request.referrerPolicy,
		mode: request.mode,
		credentials: request.credentials,
		cache: request.cache,
		redirect: request.redirect,
		integrity: request.integrity,
		...overrides,
	});
}
