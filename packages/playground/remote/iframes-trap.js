'use strict';

/**
 * Controlled iframe bootstrap.
 * Converts srcdoc/blob/data/about:blank iframes into real navigations that stay
 * under the page's Service Worker control. Also rescues already-inserted
 * same-origin iframes by virtualizing their DOM and reloading through a loader.
 */

const __once = window.__controlled_iframes_loaded__;
if (__once) {
	/* already loaded */
	return;
}
window.__controlled_iframes_loaded__ = true;

const BUCKET = 'iframe-virtual-docs-v1';

// Best-effort synchronous scope guess so we can seed src immediately in createElement.
const SYNC_SCOPE_GUESS =
	document.currentScript?.dataset.scope ??
	location.pathname.match(/^\/scope:[^/]+/)?.[0] ??
	'';

// Authoritative scope from the SW registration (async fallback to sync guess).
const scopePromise = (async () => {
	try {
		const reg = await navigator.serviceWorker.ready;
		return new URL(reg.scope).pathname.replace(/\/$/, '');
	} catch {
		return SYNC_SCOPE_GUESS.replace(/\/$/, '');
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
};

const setIframeSrc = (el, url) => {
	if (Native.iframeSrc?.set) {
		Native.iframeSrc.set.call(el, url);
	} else {
		Native.setAttribute.call(el, 'src', url);
	}
};

const uid = () =>
	`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

async function putVirtual(id, html) {
	const cache = await caches.open(BUCKET);
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
	const qs = new URLSearchParams({ base, url: prettyUrl });
	if (id) qs.set('id', id);
	return `${LOADER_PATH}#${qs.toString()}`;
}

async function rewriteSrcdoc(el, html, opts = {}) {
	const id = uid();
	await putVirtual(id, html);
	const url = await toLoaderUrl({ id, ...opts });
	setIframeSrc(el, url);
	el.setAttribute('data-controlled', '1');
}

async function rewriteDataOrBlob(el, url) {
	const res = await fetch(url);
	const html = await res.text();
	await rewriteSrcdoc(el, html);
}

// --- Interceptors ---
// 1) createElement: seed blank iframes with a real loader src synchronously.
Document.prototype.createElement = function (tagName, options) {
	const el = Native.createElement.call(this, tagName, options);
	if (String(tagName).toLowerCase() === 'iframe') {
		const ifr = el;
		try {
			if (!ifr.hasAttribute('src') && !ifr.hasAttribute('srcdoc')) {
				const { LOADER_PATH } = scopedPaths(SYNC_SCOPE_GUESS);
				if (LOADER_PATH) {
					const url = `${LOADER_PATH}#${new URLSearchParams({
						base: document.baseURI,
					}).toString()}`;
					setIframeSrc(ifr, url);
					ifr.setAttribute('data-controlled', '1');
				}
			}
			attachControlCheck(ifr);
		} catch {
			/* ignore */
		}
	}
	return el;
};

// 2) Attribute setter patch.
Element.prototype.setAttribute = function (name, value) {
	if (this instanceof HTMLIFrameElement) {
		const n = name.toLowerCase();
		const v = String(value);
		if (n === 'srcdoc') {
			void rewriteSrcdoc(this, v);
			return;
		}
		if (n === 'src') {
			if (v.startsWith('data:text/html') || v.startsWith('blob:')) {
				void rewriteDataOrBlob(this, v);
				return;
			}
			if (v === 'about:blank' || v === '') {
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

// 3) Property accessors: delegate setters to our patched setAttribute.
const Orig = {
	src: Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src'),
	srcdoc: Object.getOwnPropertyDescriptor(
		HTMLIFrameElement.prototype,
		'srcdoc'
	),
};

Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
	configurable: true,
	enumerable: Orig.src?.enumerable ?? true,
	get() {
		return Orig.src.get.call(this);
	},
	set(v) {
		Element.prototype.setAttribute.call(this, 'src', String(v));
	},
});

Object.defineProperty(HTMLIFrameElement.prototype, 'srcdoc', {
	configurable: true,
	enumerable: Orig.srcdoc?.enumerable ?? true,
	get() {
		return Orig.srcdoc.get.call(this);
	},
	set(v) {
		Element.prototype.setAttribute.call(this, 'srcdoc', String(v));
	},
});

// 4) Catch iframes added via innerHTML, templating, etc.
const mo = new MutationObserver((muts) => {
	for (const m of muts) {
		for (const n of m.addedNodes) {
			if (n instanceof HTMLIFrameElement) {
				if (!n.hasAttribute('src') && !n.hasAttribute('srcdoc')) {
					const { LOADER_PATH } = scopedPaths(SYNC_SCOPE_GUESS);
					const url = `${LOADER_PATH}#${new URLSearchParams({
						base: document.baseURI,
					}).toString()}`;
					setIframeSrc(n, url);
					n.setAttribute('data-controlled', '1');
				}
				attachControlCheck(n);
			} else if (n instanceof Element) {
				n.querySelectorAll('iframe:not([src]):not([srcdoc])').forEach(
					(ifr) => {
						const { LOADER_PATH } = scopedPaths(SYNC_SCOPE_GUESS);
						const url = `${LOADER_PATH}#${new URLSearchParams({
							base: document.baseURI,
						}).toString()}`;
						setIframeSrc(ifr, url);
						ifr.setAttribute('data-controlled', '1');
						attachControlCheck(ifr);
					}
				);
			}
		}
	}
});
mo.observe(document.documentElement, { childList: true, subtree: true });

// Helper: serialize doctype for virtualized documents.
const captureDoctype = (doc) => {
	const dt = doc.doctype;
	if (!dt) return '<!doctype html>';
	const idPublic = dt.publicId ? ` "${dt.publicId}"` : '';
	const idSystem = dt.systemId ? ` "${dt.systemId}"` : '';
	return `<!DOCTYPE ${dt.name}${idPublic}${idSystem}>`;
};

// If an iframe loaded uncontrolled (about:blank->script writes), re-virtualize it.
async function ensureIframeControlled(ifr) {
	try {
		const win = ifr.contentWindow;
		if (!win) return;
		if (win.navigator?.serviceWorker?.controller) return;

		const doc = win.document;
		if (!doc) return;
		const htmlRoot = doc.documentElement?.outerHTML ?? doc.body?.outerHTML;
		if (!htmlRoot) return;

		const html = `${captureDoctype(doc)}\n${htmlRoot}`;
		const base = doc.baseURI || document.baseURI;
		const prettyUrl = (() => {
			try {
				return doc.URL || '';
			} catch {
				return '';
			}
		})();

		await rewriteSrcdoc(ifr, html, { base, prettyUrl });
	} catch {
		/* ignore cross-origin */
	}
}

function attachControlCheck(ifr) {
	const trigger = () => void ensureIframeControlled(ifr);
	try {
		if (ifr.contentDocument?.readyState !== 'loading') {
			setTimeout(trigger, 0);
		}
		ifr.addEventListener('load', trigger);
	} catch {
		/* ignore */
	}
}

// Initial pass for already-present iframes.
document.querySelectorAll('iframe').forEach((ifr) => attachControlCheck(ifr));

// Anti-flash while the rewrite happens.
const style = document.createElement('style');
style.textContent = `iframe{visibility:hidden} iframe[data-controlled="1"]{visibility:visible}`;
document.documentElement.appendChild(style);
