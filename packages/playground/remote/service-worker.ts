/// <reference lib="WebWorker" />

declare const self: ServiceWorkerGlobalScope;

import { getURLScope, removeURLScope, setURLScope } from '@php-wasm/scopes';
import {
	awaitReply,
	convertFetchEventToPHPRequest as convertFetchEvent,
	initializeServiceWorker,
	cloneRequest,
	broadcastMessageExpectReply,
	getRequestHeaders,
} from '@php-wasm/web-service-worker';

async function convertFetchEventToPHPRequest(event: any) {
	const fullUrl = new URL(event.request.url);
	const scope = getURLScope(fullUrl);
	const res: any = await convertFetchEvent(event);
	const contentType: string = res.headers.get('content-type');
	if (contentType?.match(/text\/html/)) {
		const canonical: string = await res.text();
		let relative = canonical.replace(
			/(http|https):[\/\\]+(localhost|127.0.0.1|playground\.wordpress\.net|diy-pwa\.com)[:0-9]*\/scope:\d.\d*/g,
			`/scope:${scope}`
		);
		relative = relative.replace(/http:/g, 'https:');
		const resNew = new Response(relative, res);
		return resNew;
	} else {
		return res;
	}
}

if (!(self as any).document) {
	// Workaround: vite translates import.meta.url
	// to document.currentScript which fails inside of
	// a service worker because document is undefined
	// @ts-ignore
	// eslint-disable-next-line no-global-assign
	self.document = {};
}

initializeServiceWorker({
	handleRequest(event) {
		const fullUrl = new URL(event.request.url);
		let scope = getURLScope(fullUrl);
		if (!scope) {
			try {
				scope = getURLScope(new URL(event.request.referrer));
			} catch (e) {
				// Ignore
			}
		}
		const unscopedUrl = removeURLScope(fullUrl);
		const isReservedUrl =
			unscopedUrl.pathname.startsWith('/plugin-proxy') ||
			unscopedUrl.pathname.startsWith('/client/index.js');
		if (isReservedUrl) {
			return;
		}
		event.preventDefault();
		async function asyncHandler() {
			if (fullUrl.pathname.endsWith('/wp-includes/empty.html')) {
				return emptyHtml();
			}

			const { staticAssetsDirectory } = await getScopedWpDetails(scope!);

			let workerResponse = await convertFetchEventToPHPRequest(event);
			// If we get a 404, try to apply the WordPress URL rewrite rules.
			let rewrittenUrlString: string | undefined = undefined;
			if (workerResponse.status === 404) {
				for (const url of rewriteWordPressUrl(unscopedUrl, scope!)) {
					rewrittenUrlString = url.toString();
					workerResponse = await convertFetchEventToPHPRequest(
						await cloneFetchEvent(event, rewrittenUrlString)
					);
					if (
						workerResponse.status !== 404 ||
						workerResponse.headers.get('x-file-type') === 'static'
					) {
						break;
					}
				}
			}

			if (workerResponse.status === 404) {
				if (workerResponse.headers.get('x-file-type') === 'static') {
					// If we get a 404 for a static file, try to fetch it from
					// the from the static assets directory at the remote server.
					const requestedUrl = new URL(
						rewrittenUrlString || event.request.url
					);
					const resolvedUrl = removeURLScope(requestedUrl);
					if (
						// Vite dev server requests
						!resolvedUrl.pathname.startsWith('/@fs') &&
						!resolvedUrl.pathname.startsWith('/assets')
					) {
						resolvedUrl.pathname = `/${staticAssetsDirectory}${resolvedUrl.pathname}`;
					}
					const request = await cloneRequest(event.request, {
						url: resolvedUrl,
					});
					return fetch(request).catch((e) => {
						if (e?.name === 'TypeError') {
							// This could be an ERR_HTTP2_PROTOCOL_ERROR that sometimes
							// happen on playground.wordpress.net. Let's add a randomized
							// delay and retry once
							return new Promise((resolve) => {
								setTimeout(() => {
									resolve(fetch(request));
								}, Math.random() * 1500);
							}) as Promise<Response>;
						}

						// Otherwise let's just re-throw the error
						throw e;
					});
				} else {
					const indexPhp = setURLScope(
						new URL('/index.php', unscopedUrl),
						scope!
					);
					workerResponse = await convertFetchEventToPHPRequest(
						await cloneFetchEvent(event, indexPhp.toString())
					);
				}
			}

			// Path the block-editor.js file to ensure the site editor's iframe
			// inherits the service worker.
			// @see controlledIframe below for more details.
			if (
				// WordPress Core version of block-editor.js
				unscopedUrl.pathname.endsWith('/js/dist/block-editor.js') ||
				unscopedUrl.pathname.endsWith('/js/dist/block-editor.min.js') ||
				// Gutenberg version of block-editor.js
				unscopedUrl.pathname.endsWith('build/block-editor/index.js') ||
				unscopedUrl.pathname.endsWith('build/block-editor/index.min.js')
			) {
				const script = await workerResponse.text();
				const newScript = `${controlledIframe} ${script.replace(
					/\(\s*"iframe",/,
					'(__playground_ControlledIframe,'
				)}`;
				return new Response(newScript, {
					status: workerResponse.status,
					statusText: workerResponse.statusText,
					headers: workerResponse.headers,
				});
			}

			return workerResponse;
		}
		return asyncHandler();
	},
});

/**
 * Pair the site editor's nested iframe to the Service Worker.
 *
 * Without the patch below, the site editor initiates network requests that
 * aren't routed through the service worker. That's a known browser issue:
 *
 * * https://bugs.chromium.org/p/chromium/issues/detail?id=880768
 * * https://bugzilla.mozilla.org/show_bug.cgi?id=1293277
 * * https://github.com/w3c/ServiceWorker/issues/765
 *
 * The problem with iframes using srcDoc and src="about:blank" as they
 * fail to inherit the root site's service worker.
 *
 * Gutenberg loads the site editor using <iframe srcDoc="<!doctype html">
 * to force the standards mode and not the quirks mode:
 *
 * https://github.com/WordPress/gutenberg/pull/38855
 *
 * This commit patches the site editor to achieve the same result via
 * <iframe src="/doctype.html"> and a doctype.html file containing just
 * `<!doctype html>`. This allows the iframe to inherit the service worker
 * and correctly load all the css, js, fonts, images, and other assets.
 *
 * Ideally this issue would be fixed directly in Gutenberg and the patch
 * below would be removed.
 *
 * See https://github.com/WordPress/wordpress-playground/issues/42 for more details
 *
 * ## Why does this code live in the service worker?
 *
 * There's many ways to install the Gutenberg plugin:
 *
 * * Install plugin step
 * * Import a site
 * * Install Gutenberg from the plugin directory
 * * Upload a Gutenberg zip
 *
 * It's too difficult to patch Gutenberg in all these cases, so we blanket-patch
 * all the scripts requested over the network whose names seem to indicate they're
 * related to the Gutenberg plugin.
 */
const controlledIframe = `
/**
 * A synchronous function to read a blob URL as text.
 *
 * @param {string} url
 * @returns {string}
 */
const __playground_readBlobAsText = function (url) {
	try {
	  let xhr = new XMLHttpRequest();
	  xhr.open('GET', url, false);
	  xhr.overrideMimeType('text/plain;charset=utf-8');
	  xhr.send();
	  return xhr.responseText;
	} catch(e) {
	  return '';
	} finally {
	  URL.revokeObjectURL(url);
	}
}

window.__playground_ControlledIframe = window.wp.element.forwardRef(function (props, ref) {
	const source = window.wp.element.useMemo(function () {
		if (props.srcDoc) {
			// WordPress <= 6.2 uses a srcDoc that only contains a doctype.
			return '/wp-includes/empty.html';
		} else if (props.src && props.src.startsWith('blob:')) {
			// WordPress 6.3 uses a blob URL with doctype and a list of static assets.
			// Let's pass the document content to empty.html and render it there.
			return '/wp-includes/empty.html#' + encodeURIComponent(__playground_readBlobAsText(props.src));
		} else {
			// WordPress >= 6.4 uses a plain HTTPS URL that needs no correction.
			return props.src;
		}
	}, [props.src]);
	return (
		window.wp.element.createElement('iframe', {
			...props,
			ref: ref,
			src: source,
			// Make sure there's no srcDoc, as it would interfere with the src.
			srcDoc: undefined
		})
	)
});`;

/**
 * The empty HTML file loaded by the patched editor iframe.
 */
function emptyHtml() {
	return new Response(
		'<!doctype html><script>const hash = window.location.hash.substring(1); if ( hash ) document.write(decodeURIComponent(hash))</script>',
		{
			status: 200,
			headers: {
				'content-type': 'text/html',
			},
		}
	);
}

async function cloneFetchEvent(event: FetchEvent, rewriteUrl: string) {
	return new FetchEvent(event.type, {
		...event,
		request: await cloneRequest(event.request, {
			headers: {
				...getRequestHeaders(event.request),
				'x-rewrite-url': rewriteUrl,
			},
		}),
	});
}

type WPModuleDetails = {
	staticAssetsDirectory: string;
};

/**
 * Rewrite the URL according to WordPress .htaccess rules.
 */
function* rewriteWordPressUrl(unscopedUrl: URL, scope: string) {
	// RewriteRule ^([_0-9a-zA-Z-]+/)?(wp-(content|admin|includes).*) wordpress/$2 [L]
	const rewrittenUrl = unscopedUrl.pathname
		.toString()
		.replace(
			/^\/([_0-9a-zA-Z-]+\/)?(wp-(content|admin|includes).*)/,
			'/$2'
		);
	if (rewrittenUrl !== unscopedUrl.pathname) {
		// Something changed, let's try the rewritten URL
		const url = new URL(rewrittenUrl, unscopedUrl);
		yield setURLScope(url, scope);
	}

	// RewriteRule ^([_0-9a-zA-Z-]+/)?(.*\.php)$ wordpress/$2 [L]
	if (unscopedUrl.pathname.endsWith('.php')) {
		// The URL ends with .php, let's try to rewrite it to
		// a .php file in the WordPress root directory
		const filename = unscopedUrl.pathname.split('/').pop();
		const url = new URL('/' + filename, unscopedUrl);
		yield setURLScope(url, scope);
	}
}

const scopeToWpModule: Record<string, WPModuleDetails> = {};
async function getScopedWpDetails(scope: string): Promise<WPModuleDetails> {
	if (!scopeToWpModule[scope]) {
		const requestId = await broadcastMessageExpectReply(
			{
				method: 'getWordPressModuleDetails',
			},
			scope
		);
		scopeToWpModule[scope] = await awaitReply(self, requestId);
	}
	return scopeToWpModule[scope];
}
