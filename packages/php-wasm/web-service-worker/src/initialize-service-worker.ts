/// <reference lib="WebWorker" />
declare const self: ServiceWorkerGlobalScope;

import { awaitReply, getNextRequestId } from './messaging';
import {
	getURLScope,
	isURLScoped,
	removeURLScope,
	setURLScope,
} from '@php-wasm/scopes';

/**
 * Run this function in the service worker to install the required event
 * handlers.
 *
 * @param  config
 */
export function initializeServiceWorker(config: ServiceWorkerConfiguration) {
	const { handleRequest = defaultRequestHandler } = config;

	/**
	 * The main method. It captures the requests and loop them back to the
	 * Worker Thread using the Loopback request
	 */
	self.addEventListener('fetch', (event) => {
		const url = new URL(event.request.url);

		// Don't handle requests to the service worker script itself.
		if (url.pathname.startsWith(self.location.pathname)) {
			return;
		}

		// Only handle requests from scoped sites.
		// So – bale out if the request URL is not scoped and the
		// referrer URL is not scoped.
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
			`[ServiceWorker] Serving request: ${getRelativePart(
				removeURLScope(url)
			)}`
		);
		const responsePromise = handleRequest(event);
		if (responsePromise) {
			event.respondWith(responsePromise);
		}
	});
}

async function defaultRequestHandler(event: FetchEvent) {
	event.preventDefault();
	const url = new URL(event.request.url);
	const unscopedUrl = removeURLScope(url);
	if (!seemsLikeAPHPRequestHandlerPath(unscopedUrl.pathname)) {
		return fetch(
			await cloneRequest(event.request, {
				url,
			})
		);
	}
	return convertFetchEventToPHPRequest(event);
}

export async function convertFetchEventToPHPRequest(event: FetchEvent) {
	let url = new URL(event.request.url);

	if (!isURLScoped(url)) {
		try {
			const referrerUrl = new URL(event.request.referrer);
			url = setURLScope(url, getURLScope(referrerUrl)!);
		} catch (e) {
			// ignore
		}
	}

	const { body, files, contentType } = await rewritePost(event.request);
	const requestHeaders: Record<string, string> = {};
	for (const pair of (event.request.headers as any).entries()) {
		requestHeaders[pair[0]] = pair[1];
	}

	let phpResponse;
	try {
		const message = {
			method: 'request',
			args: [
				{
					body,
					files,
					url: url.toString(),
					method: event.request.method,
					headers: {
						...requestHeaders,
						Host: url.host,
						// Safari and Firefox don't make the User-Agent header
						// available in the fetch event. Let's add it manually:
						'User-agent': self.navigator.userAgent,
						'Content-type': contentType,
					},
				},
			],
		};
		const scope = getURLScope(url);
		if (scope === null) {
			throw new Error(
				`The URL ${url.toString()} is not scoped. This should not happen.`
			);
		}
		console.debug(
			'[ServiceWorker] Forwarding a request to the Worker Thread',
			{
				message,
			}
		);
		const requestId = await broadcastMessageExpectReply(message, scope);
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

	return new Response(phpResponse.bytes, {
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
export async function broadcastMessageExpectReply(message: any, scope: string) {
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
	handleRequest?: (event: FetchEvent) => Promise<Response> | undefined;
}

/**
 * Guesses whether the given path looks like a PHP file.
 *
 * @example
 * ```js
 * seemsLikeAPHPRequestHandlerPath('/index.php') // true
 * seemsLikeAPHPRequestHandlerPath('/index.php') // true
 * seemsLikeAPHPRequestHandlerPath('/index.php/foo/bar') // true
 * seemsLikeAPHPRequestHandlerPath('/index.html') // false
 * seemsLikeAPHPRequestHandlerPath('/index.html/foo/bar') // false
 * seemsLikeAPHPRequestHandlerPath('/') // true
 * ```
 *
 * @param  path The path to check.
 * @returns Whether the path seems like a PHP server path.
 */
export function seemsLikeAPHPRequestHandlerPath(path: string): boolean {
	return seemsLikeAPHPFile(path) || seemsLikeADirectoryRoot(path);
}

function seemsLikeAPHPFile(path: string) {
	return path.endsWith('.php') || path.includes('.php/');
}

function seemsLikeADirectoryRoot(path: string) {
	const lastSegment = path.split('/').pop();
	return !lastSegment!.includes('.');
}

async function rewritePost(request: Request) {
	const contentType = request.headers.get('content-type')!;
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
			const formData = (await request.clone().formData()) as any;
			const post: Record<string, string> = {};
			const files: Record<string, File> = {};

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
		} catch (e) {
			// ignore
		}
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
	return new Request(overrides['url'] || request.url, {
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

function getRelativePart(url: URL): string {
	return url.toString().substring(url.origin.length);
}
