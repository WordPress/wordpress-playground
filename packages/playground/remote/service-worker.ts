/// <reference lib="WebWorker" />
/**
 * Playground's service worker. Here's a rundown of non-obvious things that
 * are happening in here:
 *
 * ## Playground must be upgraded as early as possible after a new release
 *
 * New service workers call .skipWaiting(), immediately claim all the clients
 * that were controlled by the previous service worker and clears the offline
 * cache. The claimed clients are not forcibly refreshed. They just continue
 * running under the new service worker.
 *
 * Why?
 *
 * Because Playground fetches new resources asynchronously and on demand. However,
 * deploying a new webapp version of the app destroys the resources referenced in
 * the previous webapp version. Therefore, we can't allow the previous version
 * to run when a new version becomes available.
 *
 * ## Caching strategy
 *
 * Playground uses caching heavily to achieve great loading speeds and provide
 * an offline mode.
 *
 * Caching is a complex beast. Playground deals with the following cache layers:
 *
 * * HTTP cache in the browser
 * * CacheStorage in the service worker
 * * Edge Cache on playground.wordpress.net
 *
 * ### HTTP cache in the browser
 *
 * This service worker skips the browser HTTP cache for all network requests. This is because
 * the HTTP cache caused a particularly nasty problem in Playground deployments.
 *
 * Installing a new service worker purged the CacheStorage and requested a new set of assets
 * from the network. However, some of these requests were served from the HTTP cache. As a
 * result, Playground would start loading a mix of old and new assets and quickly error out.
 * What made it worse is that this broken state was cached in CacheStorage, breaking Playground
 * for weeks until the cache was refreshed.
 *
 * See https://github.com/WordPress/wordpress-playground/pull/1822 for more details.
 *
 * ### CacheStorage in the service worker
 *
 * Playground primarily relies on the **Cache first** strategy. This means assets are:
 *
 * 1. Loaded from the network without using any HTTP caching.
 * 2. Stored in the CacheStorage.
 * 3. Served from the CacheStorage on subsequent requests.
 *
 * While this strategy enables fast load times and an offline experience, it also
 * creates a substantial challenge.
 *
 * When a new Playground version is deployed, all the clients will load an old
 * version of the `remote.html` file on their next visit. Unfortunately, that old
 * `remote.html` file contains hardcoded references to assets that may not be
 * cached and no longer exist in the new webapp build.
 *
 * To solve this problem, we use the **Network first** strategy when `remote.html`
 * is requested. This introduces a small network overhead, but it guarantees loading
 * the most recent version of `remote.html` and all the referenced assets.
 *
 * Similarly, we use the **Network first** strategy for the `/` path. This is
 * useful in situations where the user didn't visit Playground in a while,
 * they have a stale version of the `/` route cached, and they open Playground.
 * If we loaded the cached version, they'd see the old Playground website on their
 * first visit and then the new Playground website only on their second visit.
 *
 * There's still a small window of time between loading the remote.html file and
 * fetching the new assets when a new deployment would break the application.
 * This should be very rare, but when it happens we provide an error message asking
 * the user to reload the page.
 *
 * ### Edge Cache on playground.wordpress.net
 *
 * The remote server (playground.wordpress.net) has an Edge Cache that's populated with
 * all static assets on every webapp deployment. All the assets served by playground.wordpress.net
 * at any point in time come from the same build and are consistent with each other. The
 * deployment process is atomic-ish so the server should never expose a mix of old and new
 * assets.
 *
 * However, what if a new webapp version is deployed right when someone downloaded 10 out of
 * 27 static assets required to boot Playground?
 *
 * Right now, they'd end up in an undefined state and likely see an error. Then, on a page refresh,
 * they'd pick up a new service worker that would purge the stale assets and boot the new webapp
 * version.
 *
 * This is not a big problem for now, but it's also not the best user experience. This can be
 * eventually solved with push notifications. A new deployment would notify all the active
 * clients to upgrade and pick up the new assets.
 *
 * ## Related resources
 *
 * * PR that turned off HTTP caching: https://github.com/WordPress/wordpress-playground/pull/1822
 * * Exploring all the cache layers: https://github.com/WordPress/wordpress-playground/issues/1774
 * * Cache first strategy: https://web.dev/articles/offline-cookbook#cache-falling-back-to-network
 * * Service worker caching and HTTP caching: https://web.dev/articles/service-worker-caching-and-http-caching
 */

declare const self: ServiceWorkerGlobalScope;

import {
	getURLScope,
	isURLScoped,
	removeURLScope,
	setURLScope,
} from '@php-wasm/scopes';
import { applyRewriteRules } from '@php-wasm/universal';
import {
	awaitReply,
	convertFetchEventToPHPRequest,
	cloneRequest,
	broadcastMessageExpectReply,
} from '@php-wasm/web-service-worker';
import { wordPressRewriteRules } from '@wp-playground/wordpress';
import { reportServiceWorkerMetrics } from '@php-wasm/logger';

import {
	cacheFirstFetch,
	networkFirstFetch,
	cacheOfflineModeAssetsForCurrentRelease,
	isCurrentServiceWorkerActive,
	purgeEverythingFromPreviousRelease,
	shouldCacheUrl,
} from './src/lib/offline-mode-cache';

if (!(self as any).document) {
	// Workaround: vite translates import.meta.url
	// to document.currentScript which fails inside of
	// a service worker because document is undefined
	// @ts-ignore
	// eslint-disable-next-line no-global-assign
	self.document = {};
}

/**
 * Forces the browser to always use the latest service worker.
 *
 * Each service worker build contains a hardcoded `buildVersion` used to derive a cache key
 * for offline-mode-cache. As long as the previous service worker is used, it will
 * keep serving a stale version of Playground assets, e.g. `/index.html`, `php.wasm`, etc.
 *
 * This is problematic for two reasons:
 *
 * 1. Users won't receive critical bugfixes for up to 24 hours after they're released [1].
 * 2. Users will experience fatal crashes. Assets such as the WebAssembly PHP builds are
 *    loaded asynchronously using fetch() and import() functions. The specific URLs are
 *    hardcoded by the bundler at build time, e.g. the worker-thread.js file contains
 *    a call similar to `import("./assets/php_8_3-2286e20c.js")`. If the browser uses
 *    a stale version of the worker thread, it will try to import a JavaScript file
 *    that no longer exists.
 *
 * See also: https://github.com/WordPress/wordpress-playground/issues/105
 *
 * [1] https://web.dev/articles/service-worker-lifecycle#updates
 */
self.addEventListener('install', (event) => {
	event.waitUntil(self.skipWaiting());
});

/**
 * Ensures:
 *
 * * The very first Playground load is controlled by this service worker.
 * * Other browser tabs are upgraded to the latest service worker.
 *
 * ## Initial load
 *
 * This is necessary because service workers don't control any pages loaded
 * before they are activated. This includes the page that actually registers
 * the service worker. You need to reload it before
 * `navigator.serviceWorker.controller` is set and the fetch() requests are
 * intercepted here.
 *
 * However, the initial Playground load already downloads a few large assets,
 * like a 12MB wordpress-static.zip file. We need to cache them these requests.
 * Otherwise they'll be fetched again on the next page load.
 *
 * client.claim() only affects pages loaded before the initial servie worker
 * registration. It shouldn't have unwanted side effects in our case. All these
 * pages would get controlled eventually anyway.
 *
 * See:
 * * The service worker lifecycle https://web.dev/articles/service-worker-lifecycle
 * * Clients.claim() docs https://developer.mozilla.org/en-US/docs/Web/API/Clients/claim
 */
self.addEventListener('activate', function (event) {
	async function doActivate() {
		await self.clients.claim();

		if (shouldCacheUrl(new URL(location.href))) {
			await purgeEverythingFromPreviousRelease();
			cacheOfflineModeAssetsForCurrentRelease();
		}
	}
	event.waitUntil(doActivate());
});

self.addEventListener('fetch', (event) => {
	if (!isCurrentServiceWorkerActive()) {
		return;
	}

	const url = new URL(event.request.url);

	// Don't handle requests to the service worker script itself.
	if (url.pathname.startsWith(self.location.pathname)) {
		return;
	}

	const isReservedUrl =
		url.pathname.startsWith('/plugin-proxy') ||
		url.pathname.startsWith('/client/index.js');
	if (isReservedUrl) {
		return;
	}

	if (url.pathname === '/feature-detect/document-isolation-policy.html') {
		return event.respondWith(documentIsolationPolicyHtml());
	}

	if (isURLScoped(url)) {
		const scope = getURLScope(url)!;
		return event.respondWith(
			handleScopedRequest(event, scope).then((response) =>
				applyCrossOriginIsolationHeaders(response, scope)
			)
		);
	}

	let referrerUrl;
	try {
		referrerUrl = new URL(event.request.referrer);
	} catch {
		// ignore
	}

	if (referrerUrl && isURLScoped(referrerUrl)) {
		if (url.origin !== referrerUrl.origin) {
			// Cross-origin requests can be handled by the service worker when they
			// are initiated from a page in the service worker's scope.
			// If this request doesn't have the referrer scope's origin,
			// let's not intercept it or send it to the scope's WordPress.
			return;
		}

		const scope = getURLScope(referrerUrl)!;

		// Let's redirect to a scope URL so that no unscoped page is loaded
		// while navigating around a scoped WordPress. Otherwise, clicking an
		// unscoped link from an unscoped page will lose the scope entirely,
		// and the service worker won't be able to match the request with
		// the right WordPress instance.
		const scopedRedirectTarget = setURLScope(event.request.url, scope);
		return event.respondWith(Response.redirect(scopedRedirectTarget));
	}

	/**
	 * A proxy that enables offline caching of cross-origin requests.
	 *
	 * For example, the following request fetching the list of all the Blueprints
	 * from the Blueprints directory:
	 *
	 * https://playground.wordpress.net/proxy/network-first-fetch/https://raw.githubusercontent.com/WordPress/blueprints/trunk/index.json
	 *
	 * would be proxied to:
	 *
	 * https://raw.githubusercontent.com/WordPress/blueprints/trunk/index.json
	 *
	 * And the response would be cached for when Playground is running in the
	 * offline mode.
	 */
	if (url.pathname.startsWith('/proxy/')) {
		const segments = url.pathname.split('/');
		const command = segments[2];
		switch (command) {
			case 'network-first-fetch': {
				const proxiedUrl =
					url.pathname.substring(
						'/proxy/'.length + command.length + 1
					) +
					(url?.search ? '?' + url.search : '') +
					(url?.hash ? '#' + url.hash : '');
				const requestWithTargetUrl = cloneRequest(event.request, {
					url: proxiedUrl,
				});
				return event.respondWith(
					requestWithTargetUrl.then(networkFirstFetch)
				);
			}
		}
	}

	if (!shouldCacheUrl(new URL(event.request.url))) {
		/**
		 * It's safe to use the regular `fetch` function here.
		 *
		 * This request won't be cached in the offline mode cache
		 * and there's no risk of the two caches interfering with
		 * each other.
		 *
		 * See service-worker.ts for more details.
		 */
		return;
	}

	/**
	 * Always fetch the fresh version of `/remote.html` and `/` from the network.
	 *
	 * This is the secret sauce that enables seamless upgrades of the
	 * running Playground clients when a new version is deployed on
	 * the server.
	 *
	 * ## The problem with deployments
	 *
	 * App deployments remove all the static assets associated with the
	 * previous app version. Meanwhile, the remote.html file we've cached
	 * for offline usage still holds references to those assets.
	 *
	 * If we just loaded the cached remote.html file, the site would crash
	 * with seemingly random errors.
	 *
	 * Instead, we fetch the most recent version of remote.html from the network.
	 * It references the static assets that are now available on the server and
	 * should work just fine.
	 *
	 * Relatedly, loading the `/` path using the network first strategy ensures
	 * that the user sees the latest version of the webapp even if they aleady
	 * have the previous version cached in CacheStorage.
	 *
	 * This very simple resolution took multiple iterations to get right. See
	 * https://github.com/WordPress/wordpress-playground/issues/1821 for more
	 * details.
	 */
	if (url.pathname === '/remote.html' || url.pathname === '/') {
		event.respondWith(networkFirstFetch(event.request));
		return;
	}

	// Use cache first strategy to serve regular static assets.
	return event.respondWith(cacheFirstFetch(event.request));
});

/**
 * A request to a PHP Worker Thread or to a regular static asset,
 * but initiated by a scoped referer (e.g. fetch() from a block editor iframe).
 */
async function handleScopedRequest(event: FetchEvent, scope: string) {
	const fullUrl = new URL(event.request.url);
	const unscopedUrl = removeURLScope(fullUrl);
	if (fullUrl.pathname.endsWith('/wp-includes/empty.html')) {
		return emptyHtml(scope);
	}

	const workerResponse = await convertFetchEventToPHPRequest(event);

	if (
		workerResponse.status === 404 &&
		workerResponse.headers.get('x-backfill-from') === 'remote-host'
	) {
		const { staticAssetsDirectory } = await getScopedWpDetails(scope!);
		if (!staticAssetsDirectory) {
			const plain404Response = workerResponse.clone();
			plain404Response.headers.delete('x-backfill-from');
			return plain404Response;
		}

		// If we get a 404 for a static file, try to fetch it from
		// the from the static assets directory at the remote server.
		const requestedUrl = new URL(event.request.url);
		const resolvedUrl = removeURLScope(requestedUrl);
		resolvedUrl.pathname = applyRewriteRules(
			resolvedUrl.pathname,
			wordPressRewriteRules
		);
		if (
			// Vite dev server requests
			!resolvedUrl.pathname.startsWith('/@fs') &&
			!resolvedUrl.pathname.startsWith('/assets')
		) {
			resolvedUrl.pathname = `/${staticAssetsDirectory}${resolvedUrl.pathname}`;
		}
		const request = await cloneRequest(event.request, {
			url: resolvedUrl,
			// Omit credentials to avoid causing cache aborts due to presence of
			// cookies
			credentials: 'omit',
		});

		/**
		 * Intentionally use fetch() over fetchFresh().
		 *
		 * At this point we know this request very likely came from WordPress
		 * and is looking for a WordPress-related static asset. WordPress
		 * has its own caching strategies in place. We're going to pass this
		 * request to the remote server as it is and let WordPress manage its
		 * own HTTP caching.
		 */
		return fetch(request).catch((e) => {
			if (e?.name === 'TypeError') {
				// This could be an ERR_HTTP2_PROTOCOL_ERROR that sometimes
				// happen on playground.wordpress.net. Let's add a randomized
				// delay and retry once
				return new Promise((resolve) => {
					setTimeout(
						() => resolve(fetch(request)),
						Math.random() * 1500
					);
				}) as Promise<Response>;
			}

			// Otherwise let's just re-throw the error
			throw e;
		});
	}

	// Path the block-editor.js file to ensure the site editor's iframe
	// inherits the service worker.
	// @see controlledIframe below for more details.
	if (
		// WordPress Core version of block-editor.js
		unscopedUrl.pathname.endsWith('/block-editor.js') ||
		unscopedUrl.pathname.endsWith('/block-editor.min.js') ||
		// Gutenberg version of block-editor.js
		unscopedUrl.pathname.endsWith('/block-editor/index.js') ||
		unscopedUrl.pathname.endsWith('/block-editor/index.min.js')
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

reportServiceWorkerMetrics(self);

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
 * It's too difficult to patch Gutenberg in all these cases, so we
 * blanket-patch all the scripts requested over the network whose names seem to
 * indicate they're related to the Gutenberg plugin.
 */
const controlledIframe = `
window.__playground_ControlledIframe = window.wp.element.forwardRef(function (props, ref) {
	const source = window.wp.element.useMemo(function () {
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
			}
		};
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
 *
 * @param scope The scope of the request, used to determine whether cross-origin isolation is needed
 */
function emptyHtml(scope: string) {
	const headers: Record<string, string> = {
		'content-type': 'text/html',
	};

	/**
	 * Only add Document-Isolation-Policy when the parent page also has cross-origin
	 * isolation headers (COEP/COOP that were rewritten to Document-Isolation-Policy).
	 *
	 * Without this header in empty.html, Gutenberg fails to populate the editor iframe
	 * with the editor markup when the editor page is loaded with COOP/COEP headers set.
	 *
	 * However, adding this header unconditionally breaks REST API authentication because
	 * `isolate-and-credentialless` causes cross-origin requests to be sent without
	 * credentials (cookies), resulting in "Session expired" errors.
	 */
	if (scopesWithCrossOriginIsolation.has(scope)) {
		headers['Document-Isolation-Policy'] = 'isolate-and-credentialless';
	}

	return new Response(
		'<!doctype html><script>const hash = window.location.hash.substring(1); if ( hash ) document.write(decodeURIComponent(hash))</script>',
		{
			status: 200,
			headers,
		}
	);
}

type WPModuleDetails = {
	staticAssetsDirectory?: string;
};

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

/**
 * Rewrites COEP/COOP headers to the newer Document-Isolation-Policy spec
 * in browsers that support it.
 *
 * ## Origin isolation
 *
 * The client-side media processing experiment relies on SharedArrayBuffer support.
 * However, SharedArrayBuffer is only available in cross-origin isolated contexts. The
 * usual way of achieving cross-origin isolation is via the Cross-Origin-Embedder-Policy (COEP)
 * and Cross-Origin-Resource-Policy (CORP) headers.
 *
 * However, COEP/COOP are viral-ish. To access SharedArrayBuffer in the site editor frame,
 * the entire chain of parent frames must have them set. This includes the two iframes on
 * playground.wordpress.net and also any site where Playground is embedded. This would break
 * embedding Playground on other sites that don't set COEP/COOP headers.
 *
 * Relying on COEP/COOP headers is fine in native WordPress, but problematic in Playground:
 *
 * * WordPress can use the COEP/COOP headers in wp-admin as every navigation triggers a full
 *   page reload and wp-admin rarely gets embedded in iframes on other pages.
 * * Playground can't easily trigger a full page reload on every navigation – that would destroy
 *   the current Playground instance. Also, Playground often gets embedded in iframes on other
 *   pages.
 *
 * ## Document-Isolation-Policy
 *
 * There is a newer specification called Document-Isolation-Policy:
 *
 * https://developer.chrome.com/blog/document-isolation-policy
 *
 * That spec enables origin isolation on a per-document basis, without affecting the rest of the
 * site. It also supports embedding external resources that don't set COEP/COOP headers. This is
 * exactly what we need for Playground.
 *
 * In a perfect world, we could just make WordPress use that header. However, it is not
 * widely supported yet and WordPress would have no easy way of detecting that support
 * server-side.
 *
 * ## Header rewriting
 *
 * Playground rewrites the COEP/COOP headers to Document-Isolation-Policy in the supporting
 * browsers. The support is decided using feature detection. As more browsers implement the
 * specification, they'll automatically start receiving the new header and a better experience.
 *
 * @see boot-playground-remote.ts for the other part of the feature detection logic.
 * @see https://github.com/WordPress/wordpress-playground/issues/2954
 * @see https://developer.chrome.com/blog/document-isolation-policy
 */
/**
 * Whether the browser supports Document-Isolation-Policy.
 * This is set via the 'message' event listener below.
 */
let browserSupportsDocumentIsolationPolicy: boolean | undefined;

/**
 * Scopes that have cross-origin isolation enabled (COEP headers were rewritten to
 * Document-Isolation-Policy). This is used to determine whether empty.html should
 * also have Document-Isolation-Policy header.
 */
const scopesWithCrossOriginIsolation = new Set<string>();

self.addEventListener('message', (event) => {
	if (event.data?.type === 'document-isolation-policy-support-check') {
		browserSupportsDocumentIsolationPolicy = event.data.supported === true;
	}
});

/**
 * Ensures cross-origin isolation is applied consistently for scoped responses.
 *
 * Handles two cases:
 *
 * 1. Response already carries `Document-Isolation-Policy`. This is what
 *    Gutenberg ≥ 22.6 / Gutenberg PR #75991 sends directly on editor screens in
 *    Chromium 137+. The response is left as-is, but the scope is tracked so
 *    that `empty.html` (the block editor's inner iframe) also receives DIP —
 *    parent and child frames need the same DIP for the editor to function
 *    (see https://github.com/WordPress/wordpress-playground/pull/3320).
 *
 * 2. Response carries COEP/COOP (older Gutenberg, WordPress core's
 *    `wp_set_up_cross_origin_isolation`, or custom plugins). When the browser
 *    supports DIP, the COEP/COOP pair is rewritten to the equivalent DIP value
 *    so the page is cross-origin isolated without making the whole host send
 *    COEP/COOP — that would break external embeds and third-party embedders of
 *    Playground.
 *
 * @param response The response to potentially modify
 * @param scope The scope of the request, used to track which scopes have cross-origin isolation
 * @returns A new Response with rewritten headers, or the original response if no changes are needed
 */
function applyCrossOriginIsolationHeaders(
	response: Response,
	scope: string
): Response {
	// If the response already opts into DIP, track the scope so empty.html gets DIP too.
	// This is the modern path once Gutenberg sends DIP directly — see
	// https://github.com/WordPress/gutenberg/pull/75991.
	if (response.headers.has('document-isolation-policy')) {
		scopesWithCrossOriginIsolation.add(scope);
		return response;
	}

	// If we don't know whether the browser supports Document-Isolation-Policy,
	// or if it doesn't support it, return the original response unchanged.
	if (!browserSupportsDocumentIsolationPolicy) {
		return response;
	}

	// Check if the response has COEP or COOP headers that we should rewrite
	if (
		!response.headers.has('cross-origin-embedder-policy') &&
		!response.headers.has('cross-origin-opener-policy')
	) {
		return response;
	}

	// Only rewrite if the response has COEP headers that indicate cross-origin isolation intent.
	// COOP alone doesn't achieve cross-origin isolation, so we key off COEP.
	const coep = response.headers.get('cross-origin-embedder-policy');
	if (!coep || (coep !== 'require-corp' && coep !== 'credentialless')) {
		return response;
	}

	/**
	 * Map COEP value to the equivalent Document-Isolation-Policy value.
	 * - require-corp → isolate-and-require-corp (strict: requires CORP/CORS on all resources)
	 * - credentialless → isolate-and-credentialless (relaxed: strips credentials instead)
	 *
	 * ## Mapping explanation
	 *
	 * COEP has three values:
	 * - `unsafe-none` (default): No cross-origin restrictions
	 * - `require-corp`: Cross-origin resources must have CORP header or use CORS
	 * - `credentialless`: Cross-origin no-cors requests sent without credentials
	 *
	 * Document-Isolation-Policy has two values that map directly to COEP's isolation modes:
	 * - `isolate-and-require-corp` ← COEP: require-corp
	 * - `isolate-and-credentialless` ← COEP: credentialless
	 *
	 * COOP is not directly mapped as Document-Isolation-Policy inherently provides the
	 * same cross-origin isolation as `COOP: same-origin` would.
	 */
	const documentIsolationPolicy =
		coep === 'require-corp'
			? 'isolate-and-require-corp'
			: 'isolate-and-credentialless';

	const newHeaders = new Headers(response.headers);
	newHeaders.delete('cross-origin-embedder-policy');
	newHeaders.delete('cross-origin-opener-policy');
	newHeaders.set('document-isolation-policy', documentIsolationPolicy);

	// Track that this scope has cross-origin isolation enabled so that
	// empty.html (the editor iframe) can also get the Document-Isolation-Policy header.
	scopesWithCrossOriginIsolation.add(scope);

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: newHeaders,
	});
}

/**
 * Serves a minimal HTML document with the `Document-Isolation-Policy` header
 * for feature detection.
 *
 * The document is served at `/feature-detection/document-isolation-policy.html` and
 * with the `Document-Isolation-Policy` header. SharedArrayBuffer is only available
 * in this document if the browser supports `Document-Isolation-Policy`.
 *
 * @see applyCrossOriginIsolationHeaders
 */
function documentIsolationPolicyHtml() {
	return new Response(
		`<!doctype html><script>
		window.parent.postMessage(
			{
				supported: typeof SharedArrayBuffer !== 'undefined'
			},
			'*'
		);
		</script>`,
		{
			status: 200,
			headers: {
				'content-type': 'text/html',
				'document-isolation-policy': 'isolate-and-credentialless',
			},
		}
	);
}
