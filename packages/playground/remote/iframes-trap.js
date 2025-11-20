'use strict';

/**
 * Controlled iframe bootstrap.
 * Converts srcdoc/blob/data/about:blank iframes into real navigations that stay
 * under the page's Service Worker control. Also rescues already-inserted
 * same-origin iframes by virtualizing their DOM and reloading through a loader.
 */

const __once = window.__controlled_iframes_loaded__;
if (!__once) {
	window.__controlled_iframes_loaded__ = true;

	const iframeCacheBucket = 'iframe-virtual-docs-v1';

	// Best-effort synchronous scope guess so we can seed src immediately in createElement.
	const inferredSiteScope =
		document.currentScript?.dataset.scope ??
		location.pathname.match(/^\/scope:[^/]+/)?.[0] ??
		'';

	// Authoritative scope from the SW registration (async fallback to sync guess).
	const scopePromise = (async () => {
		try {
			const reg = await navigator.serviceWorker.ready;
			return new URL(reg.scope).pathname.replace(/\/$/, '');
		} catch {
			return inferredSiteScope.replace(/\/$/, '');
		}
	})();

	const scopedPaths = (scope) => {
		const base = scope.replace(/\/$/, '');
		return {
			VIRTUAL_PREFIX: `${base}/__iframes/`,
			LOADER_PATH: `${base}/wp-includes/empty.html`,
		};
	};

	// Snapshot natives before we patch prototypes.
	const Native = {
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
		src: Object.getOwnPropertyDescriptor(
			HTMLIFrameElement.prototype,
			'src'
		),
		srcdoc: Object.getOwnPropertyDescriptor(
			HTMLIFrameElement.prototype,
			'srcdoc'
		),
	};

	const setIframeSrc = (iframe, url) => {
		if (Native.iframeSrc?.set) {
			Native.iframeSrc.set.call(iframe, url);
		} else {
			Native.setAttribute.call(iframe, 'src', url);
		}
	};

	const uid = () =>
		`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

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

	async function toLoaderUrl({
		id,
		prettyUrl = '',
		base = document.baseURI,
	} = {}) {
		const scope = await scopePromise;
		const { LOADER_PATH } = scopedPaths(scope);
		const queryString = new URLSearchParams({ base, url: prettyUrl });
		if (id) {
			queryString.set('id', id);
		}
		return `${LOADER_PATH}#${queryString.toString()}`;
	}

	async function rewriteSrcdoc(iframe, html, opts = {}) {
		const id = uid();
		await cacheIframeContents(id, html);
		const url = await toLoaderUrl({ id, ...opts });
		setIframeSrc(iframe, url);
		iframe.setAttribute('data-controlled', '1');
	}

	async function rewriteDataOrBlob(el, url) {
		const res = await fetch(url);
		const html = await res.text();
		await rewriteSrcdoc(el, html);
	}

	// --- Interceptors ---
	// 1) createElement: seed blank iframes with a real loader src synchronously.
	Document.prototype.createElement = function (tagName, options) {
		const element = Native.createElement.call(this, tagName, options);
		if (String(tagName).toLowerCase() === 'iframe') {
			const iframe = element;
			try {
				if (
					!iframe.hasAttribute('src') &&
					!iframe.hasAttribute('srcdoc')
				) {
					const { LOADER_PATH } = scopedPaths(inferredSiteScope);
					if (LOADER_PATH) {
						const url = `${LOADER_PATH}#${new URLSearchParams({
							base: document.baseURI,
						}).toString()}`;
						setIframeSrc(iframe, url);
						iframe.setAttribute('data-controlled', '1');
					}
				}
				attachControlCheck(iframe);
			} catch {
				/* ignore */
			}
		}
		return element;
	};

	// 2) Attribute setter patch.
	Element.prototype.setAttribute = function (name, value) {
		if (this instanceof HTMLIFrameElement) {
			const nameLower = name.toLowerCase();
			const valueString = String(value);
			if (nameLower === 'srcdoc') {
				void rewriteSrcdoc(this, valueString);
				return;
			}
			if (nameLower === 'src') {
				if (
					valueString.startsWith('data:text/html') ||
					valueString.startsWith('blob:')
				) {
					void rewriteDataOrBlob(this, valueString);
					return;
				}
				if (valueString === 'about:blank' || valueString === '') {
					void rewriteSrcdoc(this, '<!doctype html>', {
						base: document.baseURI,
						prettyUrl: location.href,
					});
					return;
				}
			}
		}
		return Native.setAttribute.call(this, name, value);
	};

	Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
		configurable: true,
		enumerable: Native.src?.enumerable ?? true,
		get() {
			return Native.src.get.call(this);
		},
		set(v) {
			Element.prototype.setAttribute.call(this, 'src', String(v));
		},
	});

	Object.defineProperty(HTMLIFrameElement.prototype, 'srcdoc', {
		configurable: true,
		enumerable: Native.srcdoc?.enumerable ?? true,
		get() {
			return Native.srcdoc.get.call(this);
		},
		set(v) {
			Element.prototype.setAttribute.call(this, 'srcdoc', String(v));
		},
	});

	// 4) Catch iframes added via innerHTML, templating, etc.
	const mutationObserver = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of mutation.addedNodes) {
				if (node instanceof HTMLIFrameElement) {
					if (
						!node.hasAttribute('src') &&
						!node.hasAttribute('srcdoc')
					) {
						const { LOADER_PATH } = scopedPaths(inferredSiteScope);
						const url = `${LOADER_PATH}#${new URLSearchParams({
							base: document.baseURI,
						}).toString()}`;
						setIframeSrc(node, url);
						node.setAttribute('data-controlled', '1');
					}
					attachControlCheck(node);
				} else if (node instanceof Element) {
					node.querySelectorAll(
						'iframe:not([src]):not([srcdoc])'
					).forEach((iframe) => {
						const { LOADER_PATH } = scopedPaths(inferredSiteScope);
						const url = `${LOADER_PATH}#${new URLSearchParams({
							base: document.baseURI,
						}).toString()}`;
						setIframeSrc(iframe, url);
						iframe.setAttribute('data-controlled', '1');
						attachControlCheck(iframe);
					});
				}
			}
		}
	});
	mutationObserver.observe(document.documentElement, {
		childList: true,
		subtree: true,
	});

	// Helper: serialize doctype for virtualized documents.
	const captureDoctype = (doc) => {
		const doctype = doc.doctype;
		if (!doctype) {
			return '<!doctype html>';
		}
		const publicId = doctype.publicId ? ` "${doctype.publicId}"` : '';
		const systemId = doctype.systemId ? ` "${doctype.systemId}"` : '';
		return `<!DOCTYPE ${doctype.name}${publicId}${systemId}>`;
	};

	// If an iframe loaded uncontrolled (about:blank->script writes), re-virtualize it.
	async function ensureIframeControlled(iframe) {
		try {
			const contentWindow = iframe.contentWindow;
			if (!contentWindow) {
				return;
			}
			if (contentWindow.navigator?.serviceWorker?.controller) {
				return;
			}

			const doc = contentWindow.document;
			if (!doc) {
				return;
			}
			const htmlRoot =
				doc.documentElement?.outerHTML ?? doc.body?.outerHTML;
			if (!htmlRoot) {
				return;
			}

			const html = `${captureDoctype(doc)}\n${htmlRoot}`;
			const base = doc.baseURI || document.baseURI;
			const prettyUrl = (() => {
				try {
					return doc.URL || '';
				} catch {
					return '';
				}
			})();

			await rewriteSrcdoc(iframe, html, { base, prettyUrl });
		} catch {
			/* ignore cross-origin */
		}
	}

	function attachControlCheck(iframe) {
		const trigger = () => void ensureIframeControlled(iframe);
		try {
			if (iframe.contentDocument?.readyState !== 'loading') {
				setTimeout(trigger, 0);
			}
			iframe.addEventListener('load', trigger);
		} catch {
			/* ignore */
		}
	}

	// Initial pass for already-present iframes.
	document
		.querySelectorAll('iframe')
		.forEach((iframe) => attachControlCheck(iframe));

	// Anti-flash while the rewrite happens.
	const style = document.createElement('style');
	style.textContent = `iframe{visibility:hidden} iframe[data-controlled="1"]{visibility:visible}`;
	document.documentElement.appendChild(style);
}
