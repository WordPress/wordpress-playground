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

import { getURLScope, isURLScoped, removeURLScope } from '@php-wasm/scopes';
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

// @ts-ignore
import iframesTrapScriptContent from './iframes-trap.js?raw';

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

/**
 * Make all iframes controlled by the service worker.
 *
 * ## The problem
 *
 * Iframes created as about:blank / srcdoc / data / blob are not controlled by this
 * service worker. This means that all network calls initiated by these iframes are
 * sent directly to the network. This means Gutenberg cannot load any CSS files,
 * TInyMCE can't load media images, etc.
 *
 * Only iframes created with `src` pointing to a URL already controlled by this service worker
 * are themselves controlled.
 *
 * ## The solution
 *
 * We inject a `iframes-trap.js` script into every HTML page to override a set of DOM
 * methods used to create iframes. Whenever an src/srcdoc attribute is set on an iframe,
 * we intercept that and:
 *
 * 1) Store the initial HTML of the iframe in CacheStorage.
 * 2) Set the iframe's src to iframeLoaderUrl (coming from a controlled URL).
 * 3) The loader replaces the iframe's content with the cached HTML.
 * 4) The loader ensures `iframes-trap.js` is also loaded and executed inside the iframe
 *    to cover any nested iframes.
 *
 * As a result, every same-origin iframe is forced onto a real navigation that the SW can control,
 * so all fetches (including <img> inside editors like TinyMCE) go through our handler
 * without per-product patches. This replaces the former Gutenberg-only shim.
 *
 * References
 *
 * - Chrome: https://bugs.chromium.org/p/chromium/issues/detail?id=880768
 * - Firefox: https://bugzilla.mozilla.org/show_bug.cgi?id=1293277
 * - Spec discussion: https://github.com/w3c/ServiceWorker/issues/765
 * - Gutenberg context: https://github.com/WordPress/gutenberg/pull/38855
 * - Playground historical issue: https://github.com/WordPress/wordpress-playground/issues/42
 */

/**
 * The CacheStorage bucked used by iframes-trap.js to store the HTML contents
 * of iframes initialized from srcdoc/data/blob.
 */
const iframeCacheBucket = 'iframe-virtual-docs-v1';
const SW_SCOPE = new URL(self.registration.scope).pathname.replace(/\/$/, '');

/**
 * A unique path prefix for all the cached iframe markup. It helps the service worker
 * decide whether the incoming request is related to a cached iframe markup.
 */
const iframeCacheKeyPrefix = `${SW_SCOPE}/__iframes/`;

/**
 * Service worker serves `./iframes-trap.js` at this path:
 */
const iframeTrapScriptUrl = `${SW_SCOPE}/__bootstrap/iframes-trap.js`;

/**
 * Service worker serves `iframeLoaderHtml` at this path. It's used
 * to initialize new iframes.
 */
const iframeLoaderPath = `${SW_SCOPE}/wp-includes/empty.html`;

/**
 * The HTML content of the iframe loader. This is the initial page
 * every iframe is forced to load when it's created.
 *
 * IMPORTANT: We do NOT use document.write() here because it causes the
 * iframe to become uncontrolled by the service worker. Instead, we use
 * DOM manipulation (innerHTML) to inject the cached content while preserving
 * service worker control.
 */
const iframeLoaderHtml = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<script src="${iframeTrapScriptUrl}" data-scope="${SW_SCOPE}"></script>
</head>
<body>
<script>
(async () => {
  const searchParams = new URLSearchParams(location.hash.slice(1));
  const id   = searchParams.get('id');
  const base = searchParams.get('base') || location.href;
  const url  = searchParams.get('url')  || '';

  // Set the base href for relative URLs
  let baseEl = document.querySelector('base');
  if (!baseEl) {
    baseEl = document.createElement('base');
    document.head.insertBefore(baseEl, document.head.firstChild);
  }
  baseEl.href = base;

  // If there's cached content to load, fetch and inject it
  if (id) {
    // Derive the scope from the current page's location
    // Handle both /scope:xxx/... and /prefix/scope:xxx/... URL formats
    const pageScope = location.pathname.match(/^(.*\\/scope:[^/]+)/)?.[1] || location.pathname.match(/^\\/scope:[^/]+/)?.[0] || '';
    const path = pageScope + '/__iframes/' + id + '.html';

    // Retry a few times - the loader may request the cached content
    // before caches.put() (started by the trap) finishes writing it.
    let html = '';
    for (let i = 0; i < 10; i++) {
      try {
        const response = await fetch(path, { cache: 'no-store' });
        if (response.ok) {
          html = await response.text();
          break;
        }
      } catch (e) {
        // Ignore fetch errors, retry
      }
      await new Promise(r => setTimeout(r, 50));
    }

    if (html) {
      // Parse the HTML to extract head and body content
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Copy head elements (except scripts that we'll handle separately)
      for (const node of doc.head.childNodes) {
        if (node.nodeName !== 'SCRIPT' && node.nodeName !== 'BASE') {
          document.head.appendChild(document.importNode(node, true));
        }
      }

      // Set body content
      document.body.innerHTML = doc.body.innerHTML;

      // Copy body attributes
      for (const attr of doc.body.attributes) {
        document.body.setAttribute(attr.name, attr.value);
      }

      // Execute scripts from the parsed document
      const scripts = doc.querySelectorAll('script');
      for (const script of scripts) {
        const newScript = document.createElement('script');
        for (const attr of script.attributes) {
          newScript.setAttribute(attr.name, attr.value);
        }
        newScript.textContent = script.textContent;
        document.body.appendChild(newScript);
      }
    }
  }

  // Update the URL to match the original intended URL
  if (url) {
    history.replaceState({}, '', url);
  }

  // Mark loader as complete so waiting code knows content is ready
  window.__playground_loader_complete__ = true;
})();
</script>
</body>
</html>`;

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

	// Serve the iframe loader
	// Match any path ending with /wp-includes/empty.html (handles scoped URLs like /scope:xxx/wp-includes/empty.html)
	if (
		event.request.mode === 'navigate' &&
		url.pathname.endsWith('/wp-includes/empty.html')
	) {
		event.respondWith(
			new Response(iframeLoaderHtml, {
				headers: { 'Content-Type': 'text/html; charset=utf-8' },
			})
		);
		return;
	}

	// Serve the cached iframe contents (written by iframe-trap.js)
	// Match paths containing /__iframes/ (handles scoped URLs like /scope:xxx/__iframes/...)
	if (url.pathname.includes('/__iframes/')) {
		event.respondWith(
			(async () => {
				const cache = await caches.open(iframeCacheBucket);
				// Use just the pathname for matching since that's what iframes-trap.js uses as the key
				const match = await cache.match(url.pathname);
				return (
					match ||
					new Response('<!doctype html>Not found', {
						status: 404,
						headers: { 'Content-Type': 'text/html; charset=utf-8' },
					})
				);
			})()
		);
		return;
	}

	// Serve the iframe-trap.js script
	// Match paths ending with /__bootstrap/iframes-trap.js (handles scoped URLs)
	if (url.pathname.endsWith('/__bootstrap/iframes-trap.js')) {
		event.respondWith(
			new Response(iframesTrapScriptContent, {
				headers: {
					'Content-Type': 'application/javascript; charset=utf-8',
				},
			})
		);
		return;
	}

	if (isURLScoped(url)) {
		return event.respondWith(handleScopedRequest(event, getURLScope(url)!));
	}

	let referrerUrl;
	try {
		referrerUrl = new URL(event.request.referrer);
	} catch {
		// ignore
	}

	if (referrerUrl && isURLScoped(referrerUrl)) {
		return event.respondWith(
			handleScopedRequest(event, getURLScope(referrerUrl)!)
		);
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

	/**
	 * Inject the iframe-trap.js script into the response.
	 */
	if (workerResponse.headers.get('content-type')?.startsWith('text/html')) {
		const body = await workerResponse.text();
		const newBody = body.replace(
			/<head>/,
			`<head><script src="${iframeTrapScriptUrl}"></script>`
		);
		return new Response(newBody, {
			headers: workerResponse.headers,
			status: workerResponse.status,
		});
	}

	return workerResponse;
}

reportServiceWorkerMetrics(self);

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
