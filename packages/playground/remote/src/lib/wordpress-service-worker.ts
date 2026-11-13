/// <reference lib="WebWorker" />
declare const self: ServiceWorkerGlobalScope;
import { playgroundOrigin, assetBaseUrl, wordPressSiteUrl } from './config';
// @ts-ignore -- Supplied by Vite.
import { buildVersion } from 'virtual:remote-config';
import {
	getWordPressBridgePath,
	isWordPressBridgePath,
} from './wordpress-bridge-path';
// @ts-ignore -- Vite bundles the transport module for generated offline HTML.
import wordpressBridgeScriptUrl from './wordpress-bridge.ts?worker&url';
import {
	getURLScope,
	isURLScoped,
	removeURLScope,
	setURLScope,
} from '@php-wasm/scopes';
import { applyRewriteRules } from '@php-wasm/universal';
import { joinPaths } from '@php-wasm/util';
import {
	awaitReply,
	convertFetchEventToPHPRequest,
	cloneRequest,
	broadcastMessageExpectReply,
} from '@php-wasm/web-service-worker';
import { wordPressRewriteRules } from '@wp-playground/wordpress';
import {
	getRemoteAccessRelayMapping,
	getRemoteAccessRelayMappingFromUrl,
	handleRemoteAccessRelayMessage,
	handleRemoteAccessRelayProbe,
	handleRemoteAccessRelayRequest,
} from '@wp-playground/remote-access';
import { RELOAD_REQUIRED } from './shared-runtime';
import {
	registerSharedRuntime,
	hasSharedRuntime,
	sendSharedRuntimeRequest,
} from './shared-runtime-service-worker';
import { getReleaseRoot } from '@wp-playground/common';
import { reportServiceWorkerMetrics } from '@php-wasm/logger';

/** Install only the WordPress HTTP transport and response handling. */
export function installWordPressServiceWorker() {
	self.addEventListener('message', (event) => {
		handleRemoteAccessRelayMessage(event);
		registerSharedRuntime(event);
	});
	self.addEventListener('fetch', handleWordPressFetch);
}

function handleWordPressFetch(event: FetchEvent) {
	const url = new URL(event.request.url);
	// Handle scoped pages only on this registration's origin. The app worker
	// must not intercept sandbox URLs, and the PHP connection rejects their
	// app-origin aliases so WordPress cannot run with app storage access.
	if (url.origin !== self.location.origin) return;
	// Public release URLs are platform files, even when requested by WordPress.
	const releaseRoot = getReleaseRoot(url);
	if (releaseRoot) {
		if (isWordPressBridgePath(url.pathname)) {
			event.respondWith(
				bridgeResponse(new URL('wordpress-bridge.js', releaseRoot))
			);
		}
		// Firefox sends a new worker's first request to the network unless this
		// service worker answered the worker's script request.
		if (event.request.destination === 'worker') {
			event.respondWith(fetch(event.request));
		}
		return;
	}

	if (
		self.location.origin !== playgroundOrigin &&
		url.origin === self.location.origin &&
		isWordPressBridgePath(url.pathname)
	) {
		// Release A's worker may still be active after release B is deployed.
		// If it answers B's helper URL, its HTML will still name A's script,
		// which the server may have removed. Generate HTML only for this worker's
		// buildVersion and the unversioned /wordpress-bridge.html compatibility URL.
		// Helper URLs naming any other build must reach the server, which serves
		// the deployed release's helper HTML and script URLs.
		if (
			url.pathname !== '/wordpress-bridge.html' &&
			url.pathname !== getWordPressBridgePath(buildVersion)
		)
			return;
		// WordPress can replace any CacheStorage entry on this origin. Generate
		// the helper from trusted worker code, including when starting offline.
		// Its script comes from a public immutable release, never WordPress-writable cache bytes.
		const scriptUrl = getReleaseRoot(assetBaseUrl)
			? new URL('wordpress-bridge.js', assetBaseUrl)
			: new URL(wordpressBridgeScriptUrl, playgroundOrigin);
		return event.respondWith(bridgeResponse(scriptUrl));
	}

	// Don't handle requests to the service worker script itself.
	if (url.pathname.startsWith(self.location.pathname)) {
		return;
	}

	// Vite's /@fs/ modules remain app assets when a scoped WordPress document
	// imports them during development. Sending them through WordPress turns the
	// module graph into scoped 404 responses.
	const sharedMode =
		new URL(self.location.href).searchParams.get('shared-worker') === '1';
	// The app handler refreshes the shared PHP worker entry point network-first,
	// which preserves offline startup.
	const isReservedUrl =
		(sharedMode && url.pathname.endsWith('/shared-playground-worker.js')) ||
		(sharedMode && url.pathname.endsWith('/personal-wp-version.json')) ||
		url.pathname.startsWith('/plugin-proxy') ||
		url.pathname.startsWith('/client/index.js') ||
		url.pathname.startsWith('/relay/') ||
		url.pathname.startsWith('/@fs/');
	if (isReservedUrl) {
		return;
	}

	// Vite bundles
	// `packages/playground/remote/src/lib/capture-site-thumbnail.ts` as the renderer
	// and `modern-screenshot/worker` as its resource worker. Their requests originate
	// from a scoped WordPress document, so the generic referrer handling below would
	// redirect them into that site's virtual URL namespace, where WordPress returns
	// a 404. Fetch these marked app assets directly instead.
	const isSiteThumbnailModule =
		url.searchParams.has('playground-site-thumbnail-module') &&
		(url.pathname === '/src/lib/capture-site-thumbnail.ts' ||
			/^\/capture-site-thumbnail-[A-Za-z0-9_-]+\.js$/.test(url.pathname));
	const isSiteThumbnailWorker =
		event.request.destination === 'worker' &&
		url.searchParams.has('playground-site-thumbnail-worker');
	if (
		isSiteThumbnailWorker &&
		self.location.origin !== playgroundOrigin &&
		url.origin === self.location.origin &&
		url.pathname.startsWith('/assets/')
	) {
		// The same-origin worker loader must not come from a WordPress-writable cache either.
		return event.respondWith(fetch(event.request));
	}
	if (isSiteThumbnailModule || isSiteThumbnailWorker) {
		// On a single-origin build the app handler serves these from its offline cache.
		if (self.location.origin === playgroundOrigin) return;
		return event.respondWith(fetch(event.request));
	}

	if (isURLScoped(url)) {
		const scope = getURLScope(url)!;
		if (url.searchParams.has('remote-access-probe')) {
			return event.respondWith(
				handleRemoteAccessRelayProbe(
					scope,
					url.searchParams.get('remote-access-probe')
				)
			);
		}
		const remoteAccessRelayMapping =
			getRemoteAccessRelayMapping(scope) ||
			getRemoteAccessRelayMappingFromUrl(scope, url);
		if (remoteAccessRelayMapping) {
			return event.respondWith(
				handleRemoteAccessRelayRequest(
					event,
					remoteAccessRelayMapping
				).then(applyCrossOriginIsolationHeaders)
			);
		}
		return event.respondWith(
			handleScopedRequest(event, scope).then(
				applyCrossOriginIsolationHeaders
			)
		);
	}

	let referrerUrl;
	try {
		referrerUrl = new URL(event.request.referrer);
	} catch {
		// ignore
	}

	if (
		referrerUrl &&
		referrerUrl.origin === wordPressSiteUrl &&
		isURLScoped(referrerUrl)
	) {
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
}

function bridgeResponse(scriptUrl: URL): Response {
	return new Response(
		`<!doctype html><title>WordPress request transport</title><script type="module" src=${JSON.stringify(scriptUrl.href)}></script>`,
		{
			headers: {
				'Content-Type': 'text/html',
				'Cache-Control': 'no-store',
			},
		}
	);
}

/**
 * Serve a scoped WordPress URL through PHP, with shared static files as a fallback.
 *
 * For /scope:site-a/wp-admin/edit.php, ask the running PHP instance for site-a to
 * handle the HTTP request. Dedicated runtimes receive it through window messages;
 * in split-origin mode the hidden WordPress iframe carries those messages across
 * to remote.html. If this service worker has a registered shared runtime, use its
 * direct connection instead. The caller also redirects unscoped same-origin URLs
 * from a scoped referrer (for example, a block-editor iframe) into this path.
 *
 * Only a 404 marked x-backfill-from: remote-host permits a public asset fetch.
 * For a minified build's omitted CSS file, remove its scope, apply WordPress
 * rewrites, and fetch from that runtime's immutable static directory on this
 * origin. Do not turn arbitrary PHP 404s into network requests. Use the browser
 * HTTP cache for public files, never WordPress-writable CacheStorage.
 */
async function handleScopedRequest(event: FetchEvent, scope: string) {
	const fullUrl = new URL(event.request.url);
	const unscopedUrl = removeURLScope(fullUrl);
	if (fullUrl.pathname.endsWith('/wp-includes/empty.html')) {
		return emptyHtml(
			fullUrl.searchParams.get('cross-origin-isolated') === '1'
		);
	}

	const workerResponse = await convertFetchEventToPHPRequest(
		event,
		(await hasSharedRuntime(scope))
			? (message, scope) =>
					sendSharedRuntimeRequest(message, scope, event)
			: undefined
	);
	if (
		workerResponse.headers.has('x-playground-reload-required') &&
		event.clientId
	) {
		const client = await self.clients.get(event.clientId);
		client?.postMessage({
			type: RELOAD_REQUIRED,
			ready:
				workerResponse.headers.get('x-playground-runtime-closed') ===
				'1',
		});
	}

	if (
		workerResponse.status === 404 &&
		workerResponse.headers.get('x-backfill-from') === 'remote-host'
	) {
		const details = await getScopedWpDetails(scope!, event);
		if (details instanceof Response) {
			if (
				details.headers.has('x-playground-reload-required') &&
				event.clientId
			) {
				const client = await self.clients.get(event.clientId);
				client?.postMessage({
					type: RELOAD_REQUIRED,
					ready:
						details.headers.get('x-playground-runtime-closed') ===
						'1',
				});
			}
			return details;
		}
		const { staticAssetsDirectory } = details;
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
			resolvedUrl.pathname = joinPaths(
				'/',
				staticAssetsDirectory,
				resolvedUrl.pathname
			);
		}
		const assetUrl = new URL(
			resolvedUrl.pathname + resolvedUrl.search,
			getReleaseRoot(assetBaseUrl)
				? self.location.origin
				: playgroundOrigin
		);
		const crossOrigin = assetUrl.origin !== self.location.origin;
		const request = await cloneRequest(event.request, {
			url: assetUrl,
			...(crossOrigin && { mode: 'cors' }),
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
		const response = await fetch(request).catch((e) => {
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
		// Legacy two-origin development still fetches from the app's Vite server.
		if (
			crossOrigin &&
			(event.request.mode === 'navigate' ||
				event.request.mode === 'same-origin')
		) {
			return new Response(response.body, response);
		}
		return response;
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
			// Rolldown uses backticks for the tag name; older builds use quotes.
			/\(\s*(["'`])iframe\1,/,
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
 * Keeps the block editor's iframes controlled by the service worker.
 *
 * The block editor renders its canvas and previews in iframes with srcDoc
 * (WordPress <= 6.2) or blob: URL (WordPress 6.3+) documents. Browsers don't
 * always route requests from such documents through the parent's service
 * worker, so their CSS, JS, fonts, and images would fail to load:
 *
 * * Chromium doesn't for blob: documents, or for srcdoc before Chrome 135.
 * * Firefox doesn't for srcdoc, blob:, or about:blank documents inside a
 *   sandboxed iframe, like Playground's WordPress iframe:
 *   https://bugzilla.mozilla.org/show_bug.cgi?id=1279406
 *
 * The wrapper below loads /wp-includes/empty.html instead, which renders the
 * blob's content itself. Unlike those documents, a document loaded from a real
 * URL is controlled by the service worker in every browser.
 *
 * See https://github.com/WordPress/wordpress-playground/issues/42 for more details.
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
		// The editor can only access the preview's DOM when both use the same
		// isolation. The URL tells empty.html whether the editor is isolated, so
		// the service worker doesn't need to remember it across restarts.
		const emptyHtmlUrl =
			'/wp-includes/empty.html' +
			(window.crossOriginIsolated ? '?cross-origin-isolated=1' : '');
		if (props.srcDoc) {
			// WordPress <= 6.2 uses a srcDoc that only contains a doctype.
			return emptyHtmlUrl;
		} else if (props.src && props.src.startsWith('blob:')) {
			// WordPress 6.3+ uses a blob URL with doctype and a list of static assets.
			// Pass the blob URL – never the document content – to empty.html, which
			// fetches and renders it itself. Only same-origin blob: URLs are honored.
			return emptyHtmlUrl + '#' + encodeURIComponent(props.src);
		} else {
			// Other URLs need no correction.
			return props.src;
		}
	}, [props.src, props.srcDoc]);
	const iframeRef = window.wp.compose.useMergeRefs([
		ref,
		source === props.src ? null : __playground_skipCredentialless,
	]);
	return (
		window.wp.element.createElement('iframe', {
			...props,
			ref: iframeRef,
			src: source,
			// Make sure there's no srcDoc, as it would interfere with the src.
			srcDoc: undefined
		})
	)
});

// Gutenberg 22.4–22.7 adds the "credentialless" attribute to every iframe in a
// cross-origin isolated editor, except the editor's own iframes, like the canvas.
// It recognizes those because their src starts with "blob:". Playground changes
// that src to /wp-includes/empty.html, so Gutenberg adds the attribute to them too.
// Chromium doesn't let the service worker control a credentialless iframe, so
// the canvas would stay blank.
//
// To prevent that, the iframe claims it already has the attribute. Gutenberg
// then leaves it alone. The attribute isn't really there, so the browser still
// loads the iframe through the service worker.
function __playground_skipCredentialless(iframe) {
	if (iframe) {
		iframe.hasAttribute = function (name) {
			return (
				name === 'credentialless' ||
				Element.prototype.hasAttribute.call(this, name)
			);
		};
	}
}`;

/**
 * Inline script served as /wp-includes/empty.html.
 *
 * The URL fragment may name a same-origin blob: URL created by the block editor
 * (WordPress 6.3). The script fetches that blob and writes its content into the
 * document. The fragment is never written directly: anything other than a blob:
 * URL on this origin is ignored, so a crafted link cannot inject markup into
 * the Playground origin. The synchronous XHR runs during the initial parse, so
 * document.write() lands before the iframe's load event.
 */
const emptyHtmlScript = `
	const hash = window.location.hash.substring(1);
	if (hash) {
		let url;
		try {
			url = new URL(decodeURIComponent(hash));
		} catch (e) {}
		if (
			url &&
			url.protocol === 'blob:' &&
			url.origin === window.location.origin
		) {
			try {
				const xhr = new XMLHttpRequest();
				xhr.open('GET', url.href, false);
				xhr.overrideMimeType('text/plain;charset=utf-8');
				xhr.send();
				document.write(xhr.responseText);
			} catch (e) {}
		}
	}
`;

/**
 * The empty HTML file loaded by the patched editor iframe.
 *
 * @param crossOriginIsolated Whether the editor document is cross-origin isolated
 */
function emptyHtml(crossOriginIsolated: boolean) {
	const headers: Record<string, string> = {
		'content-type': 'text/html',
	};

	/**
	 * Only add Document-Isolation-Policy when the editor document is isolated.
	 *
	 * The editor and its preview must use the same isolation, or Gutenberg can't
	 * access the preview's document and the preview stays blank.
	 *
	 * However, adding this header unconditionally breaks REST API authentication because
	 * `isolate-and-credentialless` causes cross-origin requests to be sent without
	 * credentials (cookies), resulting in "Session expired" errors.
	 */
	if (crossOriginIsolated) {
		headers['Document-Isolation-Policy'] = 'isolate-and-credentialless';
	}

	return new Response(
		'<!doctype html><script>' + emptyHtmlScript + '</script>',
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
async function getScopedWpDetails(
	scope: string,
	requestClient: Pick<FetchEvent, 'clientId' | 'resultingClientId'>
): Promise<WPModuleDetails | Response> {
	if (await hasSharedRuntime(scope)) {
		const result = await sendSharedRuntimeRequest(
			{ method: 'getWordPressModuleDetails', args: [] },
			scope,
			requestClient
		);
		if (result.httpStatusCode !== undefined) {
			return new Response(result.bytes, {
				status: result.httpStatusCode,
				headers: Object.fromEntries(
					Object.entries(result.headers).map(([name, values]) => [
						name,
						(values as string[]).join(', '),
					])
				),
			});
		}
		return result;
	}
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
 * Converts COEP/COOP headers to the equivalent Document-Isolation-Policy.
 *
 * ## Origin isolation
 *
 * Client-side media processing relies on SharedArrayBuffer, which is only available in
 * cross-origin isolated documents. The usual way to isolate a document is to send the
 * Cross-Origin-Embedder-Policy (COEP) and Cross-Origin-Opener-Policy (COOP) headers.
 *
 * That works in a regular WordPress site, where wp-admin is the top-level page. It can't work
 * in Playground. COOP only applies to the top-level document, and COEP must be set on every
 * frame from the top down. WordPress runs in nested iframes on playground.wordpress.net and on
 * any site that embeds Playground, so COEP/COOP never isolate it. COEP only adds restrictions:
 * the document can't embed iframes that don't send COEP, like the block editor's preview, and
 * with `require-corp`, it can't load cross-origin resources that don't send a CORP header.
 *
 * ## Document-Isolation-Policy
 *
 * Document-Isolation-Policy (DIP) isolates a single document, whatever its parent frames send:
 *
 * https://developer.chrome.com/blog/document-isolation-policy
 *
 * Playground converts COEP/COOP to DIP in every browser. Browsers that support DIP isolate the
 * document. Browsers that don't support it ignore the header, so the document isn't isolated,
 * just like with COEP/COOP, but it also isn't subject to COEP's restrictions. Converting
 * unconditionally needs no feature detection, and so no state that a service worker restart
 * could lose.
 *
 * ## Handled cases
 *
 * 1. Response already carries `Document-Isolation-Policy`. This is what
 *    WordPress 7.1+ and Gutenberg 22.6+ send directly on editor screens in
 *    Chromium 137+. Keep that policy, but remove legacy COEP/COOP restrictions
 *    that can still block the editor's nested canvas.
 *
 * 2. Response carries `COEP: require-corp` or `COEP: credentialless` (older
 *    Gutenberg with the media processing experiment, or custom plugins). The
 *    COEP/COOP pair is replaced with the matching DIP value.
 *
 * @see https://github.com/WordPress/wordpress-playground/issues/2954
 *
 * @param response The response to potentially modify
 * @returns A new Response with rewritten headers, or the original response if no changes are needed
 */
function applyCrossOriginIsolationHeaders(response: Response): Response {
	// Keep the policy that WordPress or Gutenberg sends directly. See
	// https://github.com/WordPress/gutenberg/pull/75991.
	const existingPolicy = response.headers.get('document-isolation-policy');

	// Only rewrite if DIP or COEP indicates cross-origin isolation intent.
	// COOP alone doesn't achieve cross-origin isolation, so we key off COEP.
	const coep = response.headers.get('cross-origin-embedder-policy');
	if (
		!existingPolicy &&
		coep !== 'require-corp' &&
		coep !== 'credentialless'
	) {
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
		existingPolicy ??
		(coep === 'require-corp'
			? 'isolate-and-require-corp'
			: 'isolate-and-credentialless');

	const newHeaders = new Headers(response.headers);
	// New WordPress plus older Gutenberg can send both DIP and COEP. Keeping
	// COEP would still reject empty.html even though both documents have DIP.
	newHeaders.delete('cross-origin-embedder-policy');
	newHeaders.delete('cross-origin-opener-policy');
	newHeaders.set('document-isolation-policy', documentIsolationPolicy);

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: newHeaders,
	});
}
