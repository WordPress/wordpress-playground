/// <reference lib="WebWorker" />
declare const self: ServiceWorkerGlobalScope;

import { awaitReply, getNextRequestId } from './messaging';
import { getURLScope, isURLScoped, setURLScope } from '@php-wasm/scopes';

export async function convertFetchEventToPHPRequest(event: FetchEvent) {
	let url = new URL(event.request.url);

	if (!isURLScoped(url)) {
		try {
			const referrerUrl = new URL(event.request.referrer);
			url = setURLScope(url, getURLScope(referrerUrl)!);
		} catch {
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

		// X-frame-options gets in the way when PHP is
		// being displayed in an iframe.
		delete phpResponse.headers['x-frame-options'];

		/*
		 * Content-Security-Policy can get in the way when PHP is
		 * being displayed in an iframe. WordPress 6.9 added a new
		 * `Content-Security-Policy: frame-ancestors 'self';` header that
		 * is breaking folks who embed a Playground from another origin.
		 * https://core.trac.wordpress.org/changeset/60657/
		 *
		 * Let's prune the frame-ancestors and avoid clobbering other CSP directives.
		 *
		 * NOTE: We expect all header names to be lowercase.
		 */
		if (phpResponse.headers['content-security-policy']) {
			const filteredCspHeaders = phpResponse.headers[
				'content-security-policy'
			]
				// Remove any frame-ancestors directives.
				.map((originalValue: string) =>
					removeContentSecurityPolicyDirective(
						'frame-ancestors',
						originalValue
					)
				)
				// Remove empty or whitespace-only values.
				.filter((value: string) => value.trim().length > 0);

			if (filteredCspHeaders.length > 0) {
				phpResponse.headers['content-security-policy'] =
					filteredCspHeaders;
			} else {
				// There are no remaining CSP directives, so let's remove the header altogether.
				delete phpResponse.headers['content-security-policy'];
			}
		}
	} catch (e) {
		console.error(e, { url: url.toString() });
		throw e;
	}

	/**
	 * Safari has a bug that prevents Service Workers from redirecting relative URLs.
	 * When attempting to redirect to a relative URL, the network request will return an error.
	 * See the Webkit bug for details: https://bugs.webkit.org/show_bug.cgi?id=282427.
	 *
	 * Because PHP and WordPress can redirect to both relative and absolute URLs
	 * using the `location` header we need to ensure redirects are processed
	 * correctly by the Service Worker.
	 *
	 * As a workaround for Safari Service Workers, we use `Response.redirect()`
	 * for all redirect responses (300-399 status codes) coming from PHP.
	 * This solution was suggested in the Webkit bug comment:
	 * https://bugs.webkit.org/show_bug.cgi?id=282427#c2
	 */
	if (
		phpResponse.httpStatusCode >= 300 &&
		phpResponse.httpStatusCode <= 399 &&
		phpResponse.headers['location']
	) {
		return Response.redirect(
			new URL(phpResponse.headers['location'][0], url.toString()),
			phpResponse.httpStatusCode
		);
	}
	/**
	 * Make sure we don't pass an actual body string to new Response()
	 * if the status is a null body status (101, 103, 204, 205, or 304).
	 * new Response() throws a TypeError in that case, as the fetch() spec
	 * requires.
	 *
	 * @see https://fetch.spec.whatwg.org/#statuses
	 */
	const isNullBodyCode = [101, 103, 204, 205, 304].includes(
		phpResponse.httpStatusCode
	);
	const responseBody = isNullBodyCode ? null : phpResponse.bytes;
	return new Response(responseBody, {
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
	let body: ArrayBuffer | ReadableStream | undefined;

	if (['GET', 'HEAD'].includes(request.method) || 'body' in overrides) {
		body = undefined;
	} else if (!request.bodyUsed && request.body) {
		// If the body hasn't been consumed yet, we can reuse the stream directly
		// This avoids the hang that occurs when trying to read from a stream
		// that's still waiting for more data
		body = request.body;
	} else {
		// Otherwise, we need to read the body as an arrayBuffer.
		// We don't use .blob() because it throws when the client is low
		// on disk space (blobs tend to be stored as temporary files, array
		// buffers tend to be stored in memory).
		// see https://github.com/WordPress/wordpress-playground/issues/2769
		body = await request.arrayBuffer();
	}

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
		...(body instanceof ReadableStream && { duplex: 'half' }),
		...overrides,
	});
}

/**
 * Tee a request to ensure the body stream is not consumed
 * when executing or cloning the request.
 *
 * @param request
 * @returns
 */
export async function teeRequest(
	request: Request
): Promise<[Request, Request]> {
	if (!request.body) {
		return [request, request];
	}
	const [body1, body2] = request.body.tee();
	return [
		await cloneRequest(request, { body: body1, duplex: 'half' }),
		await cloneRequest(request, { body: body2, duplex: 'half' }),
	];
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

/**
 * Removes the specified directive from the Content-Security-Policy header value.
 *
 * @param directiveToRemove The directive name to remove.
 * @param cspHeader The Content-Security-Policy header value to filter.
 * @returns The filtered Content-Security-Policy header value.
 */
export function removeContentSecurityPolicyDirective(
	directiveToRemove: string,
	cspHeader: string
) {
	// ASCII whitespace:
	// @see https://infra.spec.whatwg.org/#ascii-whitespace
	// eslint-disable-next-line no-control-regex
	const leadingAsciiWhitespace = /^[\u{9}\u{A}\u{C}\u{D}\u{20}]+/u;
	// eslint-disable-next-line no-control-regex
	const trailingAsciiWhitespace = /[\u{9}\u{A}\u{C}\u{D}\u{20}]+$/u;
	// eslint-disable-next-line no-control-regex
	const asciiWhitespace = /[\u{9}\u{A}\u{C}\u{D}\u{20}]/u;

	// Parse based on the CSP spec:
	// https://w3c.github.io/webappsec-csp/#parse-serialized-policy
	return (
		cspHeader
			// "For each token returned by strictly splitting serialized
			// on the U+003B SEMICOLON character (;):"
			.split(';')
			.filter((rawDirective: string) => {
				// "Strip leading and trailing ASCII whitespace from token."
				const trimmedDirective = rawDirective
					.replace(leadingAsciiWhitespace, '')
					.replace(trailingAsciiWhitespace, '');

				// "Let directive name be the result of collecting a sequence
				// of code points from token which are not ASCII whitespace."
				const [directiveName] = trimmedDirective.split(
					asciiWhitespace,
					// The directive name is the first token.
					1
				);

				// "Directive names are case-insensitive, that is:
				// script-SRC 'none' and ScRiPt-sRc 'none' are equivalent."
				return (
					directiveName.toLowerCase() !==
					directiveToRemove.toLowerCase()
				);
			})
			.join(';')
	);
}
