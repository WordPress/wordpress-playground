/// <reference lib="WebWorker" />
declare const self: ServiceWorkerGlobalScope;

import { awaitReply, getNextRequestId } from './messaging';
import { getURLScope, isURLScoped, setURLScope } from '@php-wasm/scopes';
import { cachedFetch, precacheResources } from './fetch-caching';
import { logger } from '@php-wasm/logger';

/**
 * Run this function in the service worker to install the required event
 * handlers.
 *
 * @param  config
 */
export function initializeServiceWorker(config: ServiceWorkerConfiguration) {
	const { handleRequest = defaultRequestHandler } = config;

	self.addEventListener('install', (event) => {
		try {
			const precachePromise = precacheResources();
			event.waitUntil(precachePromise);
		} catch (e) {
			logger.error('Failed to precache resources', e);
		}
	});

	/**
	 * The main method. It captures the requests and loop them back to the
	 * Worker Thread using the Loopback request
	 */
	self.addEventListener('fetch', (event) => {
		const url = new URL(event.request.url);
		console.log('fetch', url);

		// Don't handle requests to the service worker script itself.
		if (url.pathname.startsWith(self.location.pathname)) {
			// return;
		}
		console.log('fetch', url);

		// Only handle requests from scoped sites.
		// So – bale out if the request URL is not scoped and the
		// referrer URL is not scoped.
		if (!isURLScoped(url)) {
			let referrerUrl;
			try {
				referrerUrl = new URL(event.request.referrer);
			} catch (e) {
				logger.error('Failed to parse referrer URL', e);
				return;
			}
			if (!isURLScoped(referrerUrl)) {
				console.log('fetch', url);
				// Add caching for non-scoped requests
				return cachedFetch(event.request);
			}
		}
		const response = handleRequest(event);
		if (response) {
			event.respondWith(response);
		}
		return;
	});
}

async function defaultRequestHandler(event: FetchEvent) {
	event.preventDefault();
	const url = new URL(event.request.url);
	const workerResponse = await convertFetchEventToPHPRequest(event);
	if (
		workerResponse.status === 404 &&
		workerResponse.headers.get('x-file-type') === 'static'
	) {
		const request = await cloneRequest(event.request, {
			url,
			// Omit credentials to avoid causing cache aborts due to presence of cookies
			credentials: 'omit',
		});
		return fetch(request);
	}
	return workerResponse;
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

	const contentType = event.request.headers.get('content-type')!;
	const body =
		event.request.method === 'POST'
			? new Uint8Array(await event.request.clone().arrayBuffer())
			: undefined;
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
		const requestId = await broadcastMessageExpectReply(message, scope);
		phpResponse = await awaitReply(self, requestId);

		// X-frame-options gets in a way when PHP is
		// being displayed in an iframe.
		delete phpResponse.headers['x-frame-options'];
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
 * @param  scope   Target web worker scope.
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

/**
 * Extracts headers from a Request as a plain key->value JS object.
 *
 * @param request
 * @returns
 */
export function getRequestHeaders(request: Request) {
	const headers: Record<string, string> = {};
	request.headers.forEach((value: string, key: string) => {
		headers[key] = value;
	});
	return headers;
}
