'use strict';
var _a, _b, _c;
const __once = window.__controlled_iframes_loaded__;
if (__once) {
	/* already loaded */
}
window.__controlled_iframes_loaded__ = true;
const BUCKET = 'iframe-virtual-docs-v1';
// Best-effort synchronous scope guess so we can seed src immediately in createElement
const SYNC_SCOPE_GUESS =
	((_a = document.currentScript) === null || _a === void 0
		? void 0
		: _a.dataset.scope) ||
	((_c =
		(_b = location.pathname.match(/^\/scope:[^/]+/)) === null ||
		_b === void 0
			? void 0
			: _b[0]) !== null && _c !== void 0
		? _c
		: '');
// Async authoritative scope from the SW registration
const scopePromise = (async () => {
	try {
		const reg = await navigator.serviceWorker.ready;
		return new URL(reg.scope).pathname.replace(/\/$/, '');
	} catch (_a) {
		return SYNC_SCOPE_GUESS.replace(/\/$/, '');
	}
})();
function scopedPaths(scope) {
	const base = scope.replace(/\/$/, '');
	return {
		VIRTUAL_PREFIX: `${base}/__iframes/`,
		LOADER_PATH: `${base}/wp-includes/empty.html`,
	};
}
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
function setIframeSrc(el, url) {
	var _a;
	if ((_a = Native.iframeSrc) === null || _a === void 0 ? void 0 : _a.set) {
		Reflect.apply(Native.iframeSrc.set, el, [url]);
	} else {
		Reflect.apply(Native.setAttribute, el, ['src', url]);
	}
}
function setIframeSrcdoc(el, html) {
	var _a;
	if (
		(_a = Native.iframeSrcdoc) === null || _a === void 0 ? void 0 : _a.set
	) {
		Reflect.apply(Native.iframeSrcdoc.set, el, [html]);
	} else {
		Reflect.apply(Native.setAttribute, el, ['srcdoc', html]);
	}
}
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
async function toLoaderUrl(opts) {
	const { id, prettyUrl, base } = Object.assign(
		{ base: document.baseURI, prettyUrl: '' },
		opts
	);
	const scope = await scopePromise;
	const { LOADER_PATH } = scopedPaths(scope);
	const qs = new URLSearchParams({
		base,
		url: prettyUrl !== null && prettyUrl !== void 0 ? prettyUrl : '',
	});
	if (id) {
		qs.set('id', id);
	}
	return `${LOADER_PATH}#${qs.toString()}`;
}
async function rewriteSrcdoc(el, html, opts = {}) {
	const id = uid();
	await putVirtual(id, html);
	const url = await toLoaderUrl(Object.assign({ id }, opts));
	setIframeSrc(el, url);
	el.setAttribute('data-controlled', '1');
}
async function rewriteDataOrBlob(el, url) {
	const res = await fetch(url);
	const html = await res.text();
	await rewriteSrcdoc(el, html);
}
// --- Interceptors ---
// 1) createElement: seed blank iframes with a real loader *src* synchronously.
//    Using SYNC_SCOPE_GUESS is fine: the authoritative scope is the same or wider later.
Document.prototype.createElement = function (tagName, options) {
	const el = Reflect.apply(Native.createElement, this, [tagName, options]);
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
		} catch (_a) {}
	}
	return el;
};
// 2) Attribute form
Element.prototype.setAttribute = function (name, value) {
	if (this instanceof HTMLIFrameElement) {
		const n = name.toLowerCase();
		const v = String(value);
		if (n === 'srcdoc') {
			// Virtualize srcdoc
			void rewriteSrcdoc(this, v);
			return;
		}
		if (n === 'src') {
			if (v.startsWith('data:text/html') || v.startsWith('blob:')) {
				void rewriteDataOrBlob(this, v);
				return;
			}
			if (v === 'about:blank' || v === '') {
				// Treat about:blank like srcdoc so the iframe is a real navigation
				// and can inherit the service worker.
				void rewriteSrcdoc(this, '<!doctype html>', {
					base: document.baseURI,
					prettyUrl: location.href,
				});
				return;
			}
			// For normal URLs, let it through
		}
	}
	Reflect.apply(Native.setAttribute, this, [name, value]);
};
var _aa, _bb;
// capture originals once
const Orig = {
	src: Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src'),
	srcdoc: Object.getOwnPropertyDescriptor(
		HTMLIFrameElement.prototype,
		'srcdoc'
	),
};
// Reinstall getters/setters correctly.
// - Getter: call the original getter with the *element* as `this`.
// - Setter: delegate to Element.prototype.setAttribute so it flows through your interceptor.
Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
	configurable: true,
	enumerable:
		(_aa = Orig.src.enumerable) !== null && _aa !== void 0 ? _aa : true,
	get: function () {
		return Orig.src.get.call(this);
	},
	set: function (v) {
		// go through your patched setAttribute so data:/blob:/srcdoc normalization still applies
		Element.prototype.setAttribute.call(this, 'src', String(v));
	},
});
Object.defineProperty(HTMLIFrameElement.prototype, 'srcdoc', {
	configurable: true,
	enumerable:
		(_bb = Orig.srcdoc.enumerable) !== null && _bb !== void 0 ? _bb : true,
	get: function () {
		return Orig.srcdoc.get.call(this);
	},
	set: function (v) {
		Element.prototype.setAttribute.call(this, 'srcdoc', String(v));
	},
});

// 4) Catch iframes added via innerHTML, etc.
const mo = new MutationObserver((muts) => {
	for (const m of muts)
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
});
mo.observe(document.documentElement, { childList: true, subtree: true });
function captureDoctype(doc) {
	const dt = doc.doctype;
	if (!dt) return '<!doctype html>';
	const idPublic = dt.publicId ? ` \"${dt.publicId}\"` : '';
	const idSystem = dt.systemId ? ` \"${dt.systemId}\"` : '';
	return `<!DOCTYPE ${dt.name}${idPublic}${idSystem}>`;
}
async function ensureIframeControlled(ifr) {
	try {
		const win = ifr.contentWindow;
		if (!win) return;
		if (win.navigator?.serviceWorker?.controller) return;
		const doc = win.document;
		if (!doc) return;
		const htmlRoot = doc.documentElement?.outerHTML || doc.body?.outerHTML;
		if (!htmlRoot) return;
		const html = `${captureDoctype(doc)}\n${htmlRoot}`;
		const base = doc.baseURI || document.baseURI;
		const prettyUrl = (() => {
			try {
				return doc.URL || '';
			} catch (_a) {
				return '';
			}
		})();
		await rewriteSrcdoc(ifr, html, { base, prettyUrl });
	} catch (_b) {
		/* ignore cross-origin */
	}
}
function attachControlCheck(ifr) {
	const trigger = () => void ensureIframeControlled(ifr);
	try {
		if (
			ifr.contentDocument &&
			ifr.contentDocument.readyState !== 'loading'
		) {
			setTimeout(trigger, 0);
		}
		ifr.addEventListener('load', trigger);
	} catch (_a) {}
}
document.querySelectorAll('iframe').forEach((ifr) => attachControlCheck(ifr));
// Anti-flash while the rewrite happens
const style = document.createElement('style');
style.textContent = `iframe{visibility:hidden} iframe[data-controlled="1"]{visibility:visible}`;
document.documentElement.appendChild(style);
