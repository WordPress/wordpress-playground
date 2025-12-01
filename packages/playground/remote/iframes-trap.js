'use strict';

/**
 * Controlled iframe bootstrap.
 * Converts srcdoc/blob/data/about:blank iframes into real navigations that stay
 * under the page's Service Worker control.
 *
 * ## The Problem
 *
 * Iframes created as about:blank / srcdoc / data / blob are not controlled by the
 * service worker. This means that all network calls initiated by these iframes are
 * sent directly to the network. This breaks Gutenberg CSS loading, TinyMCE media
 * loading, etc.
 *
 * Only iframes created with src pointing to a URL already controlled by the service
 * worker are themselves controlled.
 *
 * ## The Solution
 *
 * We intercept iframe creation and attribute setting to force iframes through a
 * controlled URL (the loader). The loader then restores the original content.
 *
 * For document.write(), we let it proceed normally but ensure the iframes-trap.js
 * script is injected into the written content so nested iframes remain controlled.
 *
 * This file is loaded in multiple contexts (loader, wp-admin, etc.). It must be
 * safe to include more than once, so we guard on a global flag.
 */
function setupIframesTrap() {
	if (window.__controlled_iframes_loaded__) {
		return;
	}
	window.__controlled_iframes_loaded__ = true;

	const iframeCacheBucket = 'iframe-virtual-docs-v1';

	/**
	 * Best-effort synchronous scope guess so we can seed src immediately in createElement.
	 * Falls back to extracting scope from current pathname or empty string.
	 * Note: data-scope may be empty string if SW_SCOPE is root, so we check for truthy value.
	 */
	const inferredSiteScope =
		document.currentScript?.dataset.scope ||
		location.pathname.match(/^\/scope:[^/]+/)?.[0] ||
		'';

	/**
	 * Authoritative scope for this page.
	 * We use the inferred scope from the pathname because the SW registration
	 * scope is typically the root '/' which doesn't help us.
	 * The promise just ensures we're consistent with the sync inferredSiteScope.
	 */
	const scopePromise = Promise.resolve(inferredSiteScope.replace(/\/$/, ''));

	/**
	 * Compute scoped paths for cache and loader URLs.
	 */
	function scopedPaths(scope) {
		const base = scope.replace(/\/$/, '');
		return {
			VIRTUAL_PREFIX: `${base}/__iframes/`,
			LOADER_PATH: `${base}/wp-includes/empty.html`,
			TRAP_SCRIPT_URL: `${base}/__bootstrap/iframes-trap.js`,
		};
	}

	// Snapshot natives before we patch prototypes.
	const Native = {
		write: Document.prototype.write,
		open: Document.prototype.open,
		close: Document.prototype.close,
		createElement: Document.prototype.createElement,
		setAttribute: Element.prototype.setAttribute,
		iframeSrc: Object.getOwnPropertyDescriptor(
			HTMLIFrameElement.prototype,
			'src'
		),
		iframeSrcdoc: Object.getOwnPropertyDescriptor(
			HTMLIFrameElement.prototype,
			'srcdoc'
		),
		contentWindow: Object.getOwnPropertyDescriptor(
			HTMLIFrameElement.prototype,
			'contentWindow'
		),
		contentDocument: Object.getOwnPropertyDescriptor(
			HTMLIFrameElement.prototype,
			'contentDocument'
		),
	};

	/**
	 * Set iframe src using the native setter to avoid recursion.
	 */
	function setIframeSrc(iframe, url) {
		if (Native.iframeSrc?.set) {
			Native.iframeSrc.set.call(iframe, url);
		} else {
			Native.setAttribute.call(iframe, 'src', url);
		}
	}

	/**
	 * Generate a unique ID for caching iframe content.
	 */
	function uid() {
		return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
	}

	/**
	 * Store iframe HTML content in CacheStorage for the loader to retrieve.
	 */
	async function cacheIframeContents(id, html) {
		const cache = await caches.open(iframeCacheBucket);
		const scope = await scopePromise;
		const { VIRTUAL_PREFIX } = scopedPaths(scope);
		await cache.put(
			`${VIRTUAL_PREFIX}${id}.html`,
			new Response(html, {
				headers: { 'Content-Type': 'text/html; charset=utf-8' },
			})
		);
	}

	/**
	 * Build a loader URL that will restore cached iframe content.
	 */
	async function toLoaderUrl({ id, prettyUrl = '', base = document.baseURI } = {}) {
		const scope = await scopePromise;
		const { LOADER_PATH } = scopedPaths(scope);
		const queryString = new URLSearchParams({ base, url: prettyUrl });
		if (id) {
			queryString.set('id', id);
		}
		return `${LOADER_PATH}#${queryString.toString()}`;
	}

	/**
	 * Rewrite an iframe's srcdoc by caching the HTML and redirecting to the loader.
	 */
	async function rewriteSrcdoc(iframe, html, opts = {}) {
		const id = uid();
		await cacheIframeContents(id, html);
		const url = await toLoaderUrl({ id, ...opts });
		setIframeSrc(iframe, url);
		iframe.setAttribute('data-controlled', '1');
	}

	/**
	 * Rewrite data: or blob: URLs by fetching their content and caching it.
	 */
	async function rewriteDataOrBlob(el, url) {
		const res = await fetch(url);
		const html = await res.text();
		await rewriteSrcdoc(el, html);
	}

	/**
	 * Get the loader URL for an empty iframe (synchronous, uses inferred scope).
	 */
	function getEmptyLoaderUrl() {
		const { LOADER_PATH } = scopedPaths(inferredSiteScope);
		return `${LOADER_PATH}#${new URLSearchParams({ base: document.baseURI }).toString()}`;
	}

	// ============================================================================
	// Stash this realm's native createElement so cross-realm calls can find it
	// ============================================================================
	for (const proto of [Document.prototype, HTMLDocument?.prototype].filter(Boolean)) {
		if (!proto.__playground_native_createElement) {
			Object.defineProperty(proto, '__playground_native_createElement', {
				value: Native.createElement,
				configurable: true,
			});
		}
	}

	// ============================================================================
	// createElement wrapper - seeds blank iframes with loader src
	// ============================================================================
	const createElementWrapper = function (...args) {
		const receiver = this ?? document;

		// Same realm: safe to call our captured native
		if (receiver instanceof Document) {
			return handleCreateElement(callRealmCreateElement(receiver, args), args);
		}

		// Other realm: just call the native
		return callRealmCreateElement(receiver, args);
	};

	function callRealmCreateElement(receiver, args) {
		const attempts = [];
		const proto = receiver && Object.getPrototypeOf(receiver);

		// Try realm-native first
		if (proto?.__playground_native_createElement) {
			attempts.push(proto.__playground_native_createElement);
		}
		// Then prototype's createElement (if not our wrapper)
		if (proto?.createElement && proto.createElement !== createElementWrapper) {
			attempts.push(proto.createElement);
		}
		// Our captured native
		attempts.push(Native.createElement);
		// Last resort: bound call
		attempts.push(document.createElement.bind(document));

		for (const fn of attempts) {
			if (typeof fn !== 'function') continue;
			try {
				return Reflect.apply(fn, receiver, args);
			} catch {
				// Try next candidate
			}
		}
		throw new Error('createElement failed across all candidates');
	}

	function handleCreateElement(element, args) {
		const tagName = args[0];
		if (String(tagName).toLowerCase() !== 'iframe') {
			return element;
		}

		const iframe = element;
		try {
			const { LOADER_PATH } = scopedPaths(inferredSiteScope);
			// Only seed if no src/srcdoc is set
			if (!iframe.hasAttribute('src') && !iframe.hasAttribute('srcdoc') && LOADER_PATH) {
				const url = getEmptyLoaderUrl();
				setIframeSrc(iframe, url);
				iframe.setAttribute('data-controlled', '1');
			}
		} catch (error) {
			// Ignore errors - iframe just won't be controlled
		}
		return element;
	}

	Document.prototype.createElement = createElementWrapper;

	// ============================================================================
	// setAttribute wrapper - intercepts src/srcdoc on iframes
	// ============================================================================
	Element.prototype.setAttribute = function (name, value) {
		if (this instanceof HTMLIFrameElement) {
			const nameLower = name.toLowerCase();
			const valueString = String(value);

			if (nameLower === 'srcdoc') {
				rewriteSrcdoc(this, valueString);
				return;
			}

			if (nameLower === 'src') {
				if (valueString.startsWith('data:text/html') || valueString.startsWith('blob:')) {
					rewriteDataOrBlob(this, valueString);
					return;
				}
				if (
					valueString === 'about:blank' ||
					valueString === '' ||
					valueString.startsWith('javascript:')
				) {
					// Route through loader so the iframe is SW-controlled
					rewriteSrcdoc(this, '<!doctype html>', {
						base: document.baseURI,
						prettyUrl: location.href,
					});
					return;
				}
			}
		}
		return Native.setAttribute.call(this, name, value);
	};

	// ============================================================================
	// src/srcdoc property setters - delegate to setAttribute wrapper
	// ============================================================================
	Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
		configurable: true,
		enumerable: Native.iframeSrc?.enumerable ?? true,
		get() {
			return Native.iframeSrc.get.call(this);
		},
		set(v) {
			Element.prototype.setAttribute.call(this, 'src', String(v));
		},
	});

	Object.defineProperty(HTMLIFrameElement.prototype, 'srcdoc', {
		configurable: true,
		enumerable: Native.iframeSrcdoc?.enumerable ?? true,
		get() {
			return Native.iframeSrcdoc.get.call(this);
		},
		set(v) {
			Element.prototype.setAttribute.call(this, 'srcdoc', String(v));
		},
	});

	// ============================================================================
	// MutationObserver - catches iframes added via innerHTML, templating, etc.
	// ============================================================================
	const mutationObserver = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of mutation.addedNodes) {
				if (node instanceof HTMLIFrameElement) {
					if (!node.hasAttribute('src') && !node.hasAttribute('srcdoc')) {
						const url = getEmptyLoaderUrl();
						setIframeSrc(node, url);
						node.setAttribute('data-controlled', '1');
					}
				} else if (node instanceof Element) {
					node.querySelectorAll('iframe:not([src]):not([srcdoc])').forEach((iframe) => {
						const url = getEmptyLoaderUrl();
						setIframeSrc(iframe, url);
						iframe.setAttribute('data-controlled', '1');
					});
				}
			}
		}
	});

	mutationObserver.observe(document.documentElement, {
		childList: true,
		subtree: true,
	});

	// ============================================================================
	// Anti-flash CSS - hide iframes until they're controlled
	// ============================================================================
	const style = document.createElement('style');
	style.textContent = `iframe{visibility:hidden} iframe[data-controlled="1"]{visibility:visible}`;
	document.documentElement.appendChild(style);
}

setupIframesTrap();
