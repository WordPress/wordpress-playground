/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="WebWorker" />

declare const self: ServiceWorkerGlobalScope;

import { awaitReply, getNextRequestId } from '../messaging';
import {
	getURLScope,
	isURLScoped,
	removeURLScope,
	setURLScope,
} from '../scope';
import { getPathQueryFragment } from '../../php-library/urls';

/**
 * Run this function in the service worker to install the required event
 * handlers.
 *
 * @param  config
 */
export function initializeServiceWorker(config: ServiceWorkerConfiguration) {
	const { version, handleRequest = defaultRequestHandler } = config;
	/**
	 * Enable the client app to force-update the service worker
	 * registration.
	 */
	self.addEventListener('message', (event) => {
		if (!event.data) {
			return;
		}

		if (event.data === 'skip-waiting') {
			self.skipWaiting();
		}
	});

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
		event.waitUntil(self.clients.claim());
	});

	/**
	 * The main method. It captures the requests and loop them back to the
	 * Worker Thread using the Loopback request
	 */
	self.addEventListener('fetch', (event) => {
		const url = new URL(event.request.url);

		// Provide a custom JSON response in the special /version endpoint
		// so the frontend app can know whether it's time to update the
		// service worker registration.
		if (url.pathname === '/version') {
			event.preventDefault();
			const currentVersion =
				typeof version === 'function' ? version() : version;
			event.respondWith(
				new Response(JSON.stringify({ version: currentVersion }), {
					headers: {
						'Content-Type': 'application/json',
					},
					status: 200,
				})
			);
			return;
		}

		// Don't handle requests to the service worker script itself.
		if (url.pathname.startsWith(self.location.pathname)) {
			return;
		}

		// Don't handle any unscoped requests.
		if (!isURLScoped(url)) {
			let referrerUrl;
			try {
				referrerUrl = new URL(event.request.referrer);
			} catch (e) {
				return;
			}
			if (!isURLScoped(referrerUrl)) {
				// Let the browser handle uncoped requests as is.
				return;
			}
		}

		console.debug(
			`[ServiceWorker] Serving request: ${getPathQueryFragment(
				removeURLScope(url)
			)}`
		);
		const responsePromise = handleRequest(event);
		if (responsePromise) {
			event.respondWith(responsePromise);
		}
	});
}

async function defaultRequestHandler(event) {
	event.preventDefault();
	const url = new URL(event.request.url);
	const unscopedUrl = removeURLScope(url);
	if (!seemsLikeAPHPServerPath(unscopedUrl.pathname)) {
		return fetch(
			await cloneRequest(event.request, {
				url,
			})
		);
	}
	return PHPRequest(event);
}

export async function PHPRequest(event) {
	let url = new URL(event.request.url);

	if (!isURLScoped(url)) {
		try {
			const referrerUrl = new URL(event.request.referrer);
			url = setURLScope(url, getURLScope(referrerUrl)!);
		} catch (e) {}
	}

	const { body, files, contentType } = await rewritePost(event.request);
	const requestHeaders = {};
	for (const pair of (event.request.headers as any).entries()) {
		requestHeaders[pair[0]] = pair[1];
	}

	let phpResponse;
	try {
		const message = {
			type: 'HTTPRequest',
			request: {
				body,
				files,
				absoluteUrl: url.toString(),
				method: event.request.method,
				headers: {
					...requestHeaders,
					Host: url.host,
					'Content-type': contentType,
				},
			},
		};
		console.debug(
			'[ServiceWorker] Forwarding a request to the Worker Thread',
			{ message }
		);
		const requestId = await broadcastMessageExpectReply(
			message,
			getURLScope(url)
		);
		phpResponse = await awaitReply(self, requestId);

		// X-frame-options gets in a way when PHP is
		// being displayed in an iframe.
		delete phpResponse.headers['x-frame-options'];

		console.debug('[ServiceWorker] Response received from the main app', {
			phpResponse,
		});
	} catch (e) {
		console.error(e, { url: url.toString() });
		throw e;
	}

	return new Response(phpResponse.body, {
		headers: phpResponse.headers,
		status: phpResponse.httpStatusCode,
	});
}

/**
 * Sends the message to all the controlled clients
 * of this service worker.
 *
 * This used to be implemented with a BroadcastChannel, but
 * it didn't work in Safari. BroadcastChannel breaks iframe
 * embedding the playground in Safari.
 *
 * Weirdly, Safari does not pass any messages from the ServiceWorker
 * to Window if the page is rendered inside an iframe. Window to Service
 * Worker communication works just fine.
 *
 * The regular client.postMessage() communication works perfectly, so that's
 * what this function uses to broadcast the message.
 *
 * @param  message The message to broadcast.
 * @param  scope   Target worker thread scope.
 * @returns The request ID to receive the reply.
 */
export async function broadcastMessageExpectReply(message, scope) {
	const requestId = getNextRequestId();
	for (const client of await self.clients.matchAll({
		// Sometimes the client that triggered the current fetch()
		// event is considered uncontrolled in Google Chrome. This
		// only happens on the first few fetches() after the initial
		// registration of the service worker.
		includeUncontrolled: true,
	})) {
		client.postMessage({
			...message,
			/**
			 * Attach the scope with a URL starting with `/scope:` to this message.
			 *
			 * We need this mechanics because this worker broadcasts
			 * events to all the listeners across all browser tabs. Scopes
			 * helps WASM workers ignore requests meant for other WASM workers.
			 */
			scope,
			requestId,
		});
	}
	return requestId;
}

interface ServiceWorkerConfiguration {
	/**
	 * The version of the service worker – exposed via the /version endpoint.
	 *
	 * This is used by the frontend app to know whether it's time to update
	 * the service worker registration.
	 */
	version: string | (() => string);
	handleRequest?: (event: FetchEvent) => Promise<Response> | undefined;
}

/**
 * Guesses whether the given path looks like a PHP file.
 *
 * @example
 * ```js
 * seemsLikeAPHPServerPath('/index.php') // true
 * seemsLikeAPHPServerPath('/index.php') // true
 * seemsLikeAPHPServerPath('/index.php/foo/bar') // true
 * seemsLikeAPHPServerPath('/index.html') // false
 * seemsLikeAPHPServerPath('/index.html/foo/bar') // false
 * seemsLikeAPHPServerPath('/') // true
 * ```
 *
 * @param  path The path to check.
 * @returns Whether the path seems like a PHP server path.
 */
export function seemsLikeAPHPServerPath(path: string): boolean {
	return seemsLikeAPHPFile(path) || seemsLikeADirectoryRoot(path);
}

function seemsLikeAPHPFile(path) {
	return path.endsWith('.php') || path.includes('.php/');
}

function seemsLikeADirectoryRoot(path) {
	const lastSegment = path.split('/').pop();
	return !lastSegment.includes('.');
}

async function rewritePost(request) {
	const contentType = request.headers.get('content-type');
	if (request.method !== 'POST') {
		return {
			contentType,
			body: undefined,
			files: undefined,
		};
	}

	// If the request contains multipart form data, rewrite it
	// to a regular form data and handle files separately.
	const isMultipart = contentType
		.toLowerCase()
		.startsWith('multipart/form-data');
	if (isMultipart) {
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

			return {
				contentType: 'application/x-www-form-urlencoded',
				body: new URLSearchParams(post).toString(),
				files,
			};
		} catch (e) {}
	}

	// Otherwise, grab body as literal text
	return {
		contentType,
		body: await request.clone().text(),
		files: {},
	};
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
 * @param  request
 * @param  overrides
 * @returns The new request.
 */
export async function cloneRequest(
	request: Request,
	overrides: Record<string, any>
): Promise<Request> {
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
		mode: request.mode === 'navigate' ? 'same-origin' : request.mode,
		credentials: request.credentials,
		cache: request.cache,
		redirect: request.redirect,
		integrity: request.integrity,
		...overrides,
	});
}
