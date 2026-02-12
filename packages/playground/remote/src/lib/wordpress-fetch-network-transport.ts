import { logger } from '@php-wasm/logger';
import type { UniversalPHP } from '@php-wasm/universal';
import { fetchWithCorsProxy } from '@php-wasm/web-service-worker';
import { defineWpConfigConsts } from '@wp-playground/blueprints';

export interface RequestData {
	url: string;
	method?: string;
	headers?: Record<string, string>;
	data?: string;
}

export interface RequestMessage {
	type: 'request';
	data: RequestData;
}

export interface SetupFetchNetworkTransportOptions {
	corsProxyUrl?: string;
}

type WordPressRequest = {
	url: string;
	body?: any;
	cookies?: any[];
	headers?: any[];
	method?: string;
};

/**
 * Allow WordPress to make network requests via the fetch API.
 * On the WordPress side, this is handled by Requests_Transport_Fetch
 *
 * This function also implements a caching layer for pre-fetched admin requests
 * to improve wp-admin load performance.
 *
 * Usage:
 *
 * ```ts
 * const transport = new FetchNetworkTransport(playground);
 * await transport.setup( php );
 *
 * // The transport is disabled by default, let's enable it:
 * await transport.enable( php );
 * ```
 *
 * @param playground the Playground instance to set up with network support.
 */
export class WordPressFetchNetworkTransport {
	private options: SetupFetchNetworkTransportOptions;
	private preloadedResponseCache = new Map<
		string,
		{
			status: number;
			statusText: string;
			headers: Record<string, string>;
			data: string;
		}
	>();

	constructor(options?: SetupFetchNetworkTransportOptions) {
		this.options = options || {};
	}

	/**
	 * Enable or disable network requests
	 */
	async setEnabled(
		playground: UniversalPHP,
		enabled: boolean
	): Promise<void> {
		await defineWpConfigConsts(playground, {
			consts: {
				USE_FETCH_FOR_REQUESTS: enabled,
			},
		});
	}

	/**
	 * Set up the message handler for network requests. This only sets up the
	 * message handler, it does not enable the transport. You will still need
	 * to call `transport.setEnabled(php, true)` to enable it.
	 */
	async setupMessageHandler(playground: UniversalPHP) {
		return await playground.onMessage(async (message: string) => {
			let envelope: RequestMessage;
			try {
				// PHP-WASM sends messages as strings, so we can't expect valid JSON.
				envelope = JSON.parse(message);
			} catch {
				return '';
			}
			const { type, data } = envelope;
			if (type !== 'request') {
				return '';
			}

			// Check if we have a cached response first
			const cachedResponse = this.preloadedResponseCache.get(data.url);
			if (cachedResponse) {
				logger.info('Using cached response for:', data.url);

				// Convert the cached response back to the format expected by PHP
				const responseHeaders: string[] = [];
				Object.entries(cachedResponse.headers).forEach(
					([key, value]) => {
						responseHeaders.push(key + ': ' + value);
					}
				);

				const headersText =
					[
						'HTTP/1.1 ' +
							cachedResponse.status +
							' ' +
							cachedResponse.statusText,
						...responseHeaders,
					].join('\r\n') + '\r\n\r\n';

				const headersBuffer = new TextEncoder().encode(headersText);
				const bodyBuffer = new TextEncoder().encode(
					cachedResponse.data
				);
				const jointBuffer = new Uint8Array(
					headersBuffer.byteLength + bodyBuffer.byteLength
				);
				jointBuffer.set(headersBuffer);
				jointBuffer.set(bodyBuffer, headersBuffer.byteLength);

				// Remove from cache after use to prevent stale data
				this.preloadedResponseCache.delete(data.url);

				return jointBuffer;
			}

			// PHP encodes empty arrays as JSON arrays, not objects.
			// We can't easily reason about the request body, but we know
			// headers should be an object so let's convert it here.
			if (!data.headers) {
				data.headers = {};
			} else if (Array.isArray(data.headers)) {
				data.headers = Object.fromEntries(data.headers);
			}

			const corsProxyUrl = this.options?.corsProxyUrl;
			const playgroundUrl = await playground.absoluteUrl;
			return handleRequest(data, (url: any, options: any) =>
				fetchWithCorsProxy(url, options, corsProxyUrl, playgroundUrl)
			);
		});
	}

	/**
	 * Parallelizes the slow initial burst of api.w.org/update_check requests
	 * that's sent on the first wp-admin load. Instead of issuing them one by one
	 * and making the user wait a few seconds, we pre-fetch them in parallel.
	 *
	 * The approach:
	 * 1. Call wp_update_* functions and intercept the HTTP requests they make
	 * 2. Store the intercepted request details
	 * 3. Make parallel fetch requests to get responses
	 * 4. Cache the responses for later use by the network transport.
	 * 5. When the user makes the actual requests later, serve from cache instead.
	 */
	async prefetchUpdateChecks(
		playground: UniversalPHP
	): Promise<Promise<any>[]> {
		const requests: Record<string, WordPressRequest> = {};
		const unbind = await playground.onMessage((message) => {
			const parsed = JSON.parse(message);
			if (parsed.type === 'parallelize_request') {
				const url = new URL(parsed.url);
				url.protocol = 'https:';

				requests[url.toString()] = {
					url: url.toString(),
					...parsed.request,
				};
			}
		});

		await playground.run({
			code: `<?php
				require_once '/wordpress/wp-load.php';
				require_once '/wordpress/wp-admin/includes/misc.php';
				require_once '/wordpress/wp-admin/includes/dashboard.php';
				add_filter('pre_http_request', function($pre, $r, $url) {
					post_message_to_js(json_encode([
						'type' => 'parallelize_request',
						'url' => $url,
						'request' => $r
					]));
					return new WP_Error( 'http_request_block', __( "This request is not allowed", "textdomain" ) );
				}, 10, 3);

				// Set the user agent header required by wp_check_browser_version()
				$_SERVER['HTTP_USER_AGENT'] = getenv('HTTP_USER_AGENT');

				// Store which transients existed before we start
				$browser_transient_key = 'browser_' . md5(getenv('HTTP_USER_AGENT'));
				$php_transient_key = 'php_check_' . md5(PHP_VERSION);
				$existing_transients = [
					'browser' => get_site_transient($browser_transient_key) !== false,
					'php_check' => get_site_transient($php_transient_key) !== false,
					'update_plugins' => get_site_transient('update_plugins') !== false,
					'update_themes' => get_site_transient('update_themes') !== false,
					'update_core' => get_site_transient('update_core') !== false,
				];

				if (!$existing_transients['browser']) {
					wp_check_browser_version();
					delete_site_transient($browser_transient_key);
				}

				if (!$existing_transients['php_check']) {
					wp_check_php_version();
					delete_site_transient($php_transient_key);
				}

				// Set up custom error handler to suppress specific WordPress.org connection warnings:
				// * wp_update_plugins(): An unexpected error occurred. Something may be wrong with WordPress.org or this server&#8217;s configuration. If you continue to have problems, please try the <a href="https://wordpress.org/support/forums/">support forums</a>. (WordPress could not establish a secure connection to WordPress.org. Please contact your server administrator.) in /wordpress/wp-includes/functions.php on line 135
				// * wp_update_themes(): An unexpected error occurred. Something may be wrong with WordPress.org or this server&#8217;s configuration. If you continue to have problems, please try the <a href="https://wordpress.org/support/forums/">support forums</a>. (WordPress could not establish a secure connection to WordPress.org. Please contact your server administrator.) in /wordpress/wp-includes/functions.php on line 135
				// * wp_version_check(): An unexpected error occurred. Something may be wrong with WordPress.org or this server&#8217;s configuration. If you continue to have problems, please try the <a href="https://wordpress.org/support/forums/">support forums</a>. (WordPress could not establish a secure connection to WordPress.org. Please contact your server administrator.) in /wordpress/wp-includes/functions.php on line 135
				$previous_error_handler = set_error_handler(function($errno, $errstr, $errfile, $errline) {
					global $previous_error_handler;
					if (
						strpos($errstr, 'WordPress could not establish a secure connection to WordPress.org') !== false ||
						strpos($errstr, 'An unexpected error occurred. Something may be wrong with WordPress.org') !== false
					) {
						return true;
					}
					// For all other errors, use the previous error handler or default behavior
					if ($previous_error_handler) {
						return call_user_func($previous_error_handler, $errno, $errstr, $errfile, $errline);
					}
					return false; // Use default error handling
				});

				if (!$existing_transients['update_plugins']) {
					wp_update_plugins();
					delete_site_transient('update_plugins');
				}

				if (!$existing_transients['update_themes']) {
					wp_update_themes();
					delete_site_transient('update_themes');
				}

				if (!$existing_transients['update_core']) {
					wp_version_check();
					delete_site_transient('update_core');
				}
			`,
			env: {
				HTTP_USER_AGENT: navigator.userAgent,
			},
		});
		await unbind();

		logger.info(
			`Intercepted ${
				Object.keys(requests).length
			} admin requests for pre-fetching`
		);

		const fetchPromises = Object.values(requests).map(async (request) => {
			const method = request?.method || 'GET';
			let body: BodyInit | undefined = undefined;
			let isUrlEncoded = false;
			if (method !== 'GET' && request?.body) {
				if (
					typeof request.body === 'object' &&
					!(request.body instanceof FormData)
				) {
					body = new URLSearchParams(request.body).toString();
					isUrlEncoded = true;
				} else {
					body = request.body;
				}
			}
			const rawHeaders = Array.isArray(request?.headers)
				? Object.fromEntries(request.headers)
				: request?.headers || {};

			// If submitting urlencoded form, indicate that in the headers
			const headers = { ...rawHeaders };
			if (isUrlEncoded) {
				headers['Content-Type'] =
					'application/x-www-form-urlencoded;charset=UTF-8';
			}

			const fetchOptions: RequestInit = {
				method,
				headers,
				body,
			};

			try {
				const response = await fetch(request.url, fetchOptions);
				const data = await response.text();

				// Convert headers properly
				const responseHeaders: Record<string, string> = {};
				response.headers.forEach((value, key) => {
					responseHeaders[key] = value;
				});

				const cachedResponse = {
					url: request.url,
					status: response.status,
					statusText: response.statusText,
					headers: responseHeaders,
					data,
				};

				// Store in instance cache
				this.preloadedResponseCache.set(request.url, cachedResponse);

				return cachedResponse;
			} catch (error) {
				logger.warn(
					`Failed to pre-fetch admin request: ${request.url}`,
					error
				);
				return null;
			}
		});

		/**
		 * Do not await these promises. They're already in the cache at this point,
		 * and calling await setupFetchNetworkTransport() is only meant to await
		 * loading these requests into the cache, not await the responses. If the caller
		 * wants to await the responses they can call Promise.all() on the returned
		 * array.
		 */
		return fetchPromises;
	}
}

export async function handleRequest(data: RequestData, fetchFn = fetch) {
	let response;
	try {
		const fetchMethod = data.method || 'GET';
		const fetchHeaders = data.headers || {};

		const hasContentTypeHeader = Object.keys(fetchHeaders).some(
			(name) => name.toLowerCase() === 'content-type'
		);

		if (fetchMethod == 'POST' && !hasContentTypeHeader) {
			fetchHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
		}

		response = await fetchFn(data.url, {
			method: fetchMethod,
			headers: fetchHeaders,
			body: fetchMethod === 'GET' ? undefined : data.data,
			credentials: 'omit',
		});
	} catch {
		return new TextEncoder().encode(
			`HTTP/1.1 400 Invalid Request\r\ncontent-type: text/plain\r\n\r\nPlayground could not serve the request.`
		);
	}
	const responseHeaders: string[] = [];
	response.headers.forEach((value, key) => {
		responseHeaders.push(key + ': ' + value);
	});

	/*
	 * Technically we should only send ASCII here and ensure we don't send control
	 * characters or newlines. We ought to be very careful with HTTP headers since
	 * some attacks rely on assumed processing of them to let things slip in that
	 * would end the headers section before its done. e.g. we don't want to allow
	 * emoji in a header and we don't want to allow \r\n\r\n in a header.
	 *
	 * That being said, the browser takes care of it for us.
	 * response.headers is an instance of the Headers class, and you just can't
	 * construct the Headers instance if the values are malformed:
	 *
	 * > new Headers({'Content-type': 'text/html\r\n\r\nBreakout!'})
	 * Failed to construct 'Headers': Invalid value
	 */
	const headersText =
		[
			'HTTP/1.1 ' + response.status + ' ' + response.statusText,
			...responseHeaders,
		].join('\r\n') + `\r\n\r\n`;
	const headersBuffer = new TextEncoder().encode(headersText);
	const bodyBuffer = new Uint8Array(await response.arrayBuffer());
	const jointBuffer = new Uint8Array(
		headersBuffer.byteLength + bodyBuffer.byteLength
	);
	jointBuffer.set(headersBuffer);
	jointBuffer.set(bodyBuffer, headersBuffer.byteLength);

	return jointBuffer;
}
