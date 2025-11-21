'use strict';

/**
 * Controlled iframe bootstrap.
 * Converts srcdoc/blob/data/about:blank iframes into real navigations that stay
 * under the page's Service Worker control. Also rescues already-inserted
 * same-origin iframes by virtualizing their DOM and reloading through a loader.
 *
 * This file is loaded in multiple contexts (loader, wp-admin, etc.). It must be
 * safe to include more than once, so we guard on a global flag and avoid
 * top-level const redefinitions.
 */
function setupIframesTrap() {
	// Document.prototype.write = function (html) {
	// 	console.log('intercepting document.write', html);
	// 	// return Native.write.call(this, html);
	// };

	if (!window.__controlled_iframes_loaded__) {
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
			write: Document.prototype.write,
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
			contentWindow: Object.getOwnPropertyDescriptor(
				HTMLIFrameElement.prototype,
				'contentWindow'
			),
			contentDocument: Object.getOwnPropertyDescriptor(
				HTMLIFrameElement.prototype,
				'contentDocument'
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
			`${Date.now().toString(36)}-${Math.random()
				.toString(36)
				.slice(2, 10)}`;

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
		Document.prototype.write = function (html) {
			console.log('intercepting document.write', html);
			// @TODO: parse etc.
			// Ensure <base> is correctly set before writing HTML to the document
			if (typeof html === 'string' && html.trim().length > 0) {
				let baseHref = document.baseURI;
				let baseTag = `<base href="${baseHref.replace(
					/"/g,
					'&quot;'
				)}">`;
				// Only inject <base> if one does not exist in the html being written
				if (!/<base[\s\S]*?href[\s\S]*?=/.test(html)) {
					// Try to insert right after <head>, or at the top if <head> not present
					if (/<head[\s\S]*?>/i.test(html)) {
						html = html.replace(
							/(<head[\s\S]*?>)/i,
							`$1${baseTag}`
						);
					} else {
						html = baseTag + html;
					}
				}
			}
			return Native.write.call(this, html);
		};

		// Stash this realm's native createElement on both Document and HTMLDocument
		// so other realms (or our own helpers) can find it without re-entering the wrapper.
		for (const proto of [
			Document.prototype,
			HTMLDocument?.prototype,
		].filter(Boolean)) {
			if (!proto.__playground_native_createElement) {
				Object.defineProperty(
					proto,
					'__playground_native_createElement',
					{
						value: Native.createElement,
						configurable: true,
					}
				);
			}
		}

		const createElementWrapper = function (...args) {
			/**
			 * Always call the native createElement belonging to the receiver's realm.
			 * Using a cached native from a different realm triggers "Illegal invocation".
			 */
			const receiver = this ?? document;
			// Same realm: safe to call our captured native.
			if (receiver instanceof Document) {
				return handleCreateElement(
					callRealmCreateElement(receiver, args),
					args
				);
			}

			// Other realm: reach for that realm's native createElement if exposed.
			const element = callRealmCreateElement(receiver, args);
			return element;
		};

		function callRealmCreateElement(receiver, args) {
			const attempts = [];

			// 1) Receiver's own realm-native (if we, or that realm, stashed it).
			const proto = receiver && Object.getPrototypeOf(receiver);
			if (proto?.__playground_native_createElement) {
				attempts.push(proto.__playground_native_createElement);
			}

			// 2) Receiver prototype's current createElement (native if that realm
			// hasn't been patched yet; safe if it's not our wrapper).
			if (
				proto?.createElement &&
				proto.createElement !== createElementWrapper
			) {
				attempts.push(proto.createElement);
			}

			// 3) Our own captured native for this realm.
			attempts.push(Native.createElement);

			// 4) Bound document.createElement as a last resort.
			attempts.push(document.createElement.bind(document));

			for (const fn of attempts) {
				if (typeof fn !== 'function') {
					continue;
				}
				try {
					return Reflect.apply(fn, receiver, args);
				} catch (e) {
					// Try the next candidate.
				}
			}

			throw new Error('createElement failed across all candidates');
		}

		function handleCreateElement(element, args) {
			const tagName = args[0];
			const options = args[1];
			if (String(tagName).toLowerCase() === 'iframe') {
				const iframe = element;
				try {
					// console.log(
					// 	'intercepting iframe createElement',
					// 	tagName,
					// 	options
					// );
					const { LOADER_PATH } = scopedPaths(inferredSiteScope);
					if (
						!iframe.hasAttribute('src') &&
						!iframe.hasAttribute('srcdoc')
					) {
						// console.log('initializing to loader', LOADER_PATH);
						if (LOADER_PATH) {
							// console.log('setting iframe src', LOADER_PATH);
							const url = `${LOADER_PATH}#${new URLSearchParams({
								base: document.baseURI,
							}).toString()}`;
							setIframeSrc(iframe, url);
							iframe.setAttribute('data-controlled', '1');
						}
					} else {
						const script = document.createElement('script');
						script.src = `${LOADER_PATH}#${new URLSearchParams({
							base: document.baseURI,
						}).toString()}`;
						iframe.contentDocument.head.prepend(script);
					}
					// On every iframe load, disable document.write in it
					iframe.addEventListener('load', function () {
						try {
							if (
								iframe.contentWindow &&
								iframe.contentWindow.document
							) {
								iframe.contentWindow.document.write =
									function () {
										throw new Error(
											'document.write is disabled in this iframe'
										);
									};
							}
						} catch (e) {
							// Could be cross-origin or not ready, ignore
						}
					});
				} catch (error) {
					console.error('error setting iframe src', iframe);
					console.error(error);
					/* ignore */
				}
			}
			return element;
		}

		// 1) createElement: seed blank iframes with a real loader src synchronously.
		Document.prototype.createElement = createElementWrapper;

		// 2) Attribute setter patch.
		Element.prototype.setAttribute = function (name, value) {
			if (this instanceof HTMLIFrameElement) {
				const nameLower = name.toLowerCase();
				const valueString = String(value);
				if (nameLower === 'srcdoc') {
					// console.log('intercepting iframe srcdoc', valueString);
					void rewriteSrcdoc(this, valueString);
					return;
				}
				if (nameLower === 'src') {
					// console.log('intercepting iframe set src', valueString);
					if (
						valueString.startsWith('data:text/html') ||
						valueString.startsWith('blob:')
					) {
						void rewriteDataOrBlob(this, valueString);
						return;
					}
					if (
						valueString === 'about:blank' ||
						valueString === '' ||
						valueString.startsWith('javascript:')
					) {
						// Treat javascript:/blank src as a request for a controlled, empty doc.
						// We route it through the loader so the iframe is SW-controlled from
						// the very first real navigation.
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
				console.log('intercepting iframe src', v);
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
				console.log('intercepting iframe srcdoc', v);
				Element.prototype.setAttribute.call(this, 'srcdoc', String(v));
			},
		});

		Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
			configurable: true,
			enumerable: Native.contentWindow?.enumerable ?? true,
			get() {
				// console.trace('intercepting iframe contentWindow get', this);
				const iframe = this;
				const contentWindow = Native.contentWindow.get.call(this);
				if (contentWindow) {
					// contentDocument may be undefined, so wait for iframe to load before injecting script
					const injectScript = () => {
						const doc =
							contentWindow.document ||
							contentWindow.contentDocument;
						// console.log('pre inject script', doc);
						if (doc && doc.head) {
							// console.log('injecting script', setupIframesTrap);
							// const script = document.createElement('script');
							// script.src =
							// 	setupIframesTrap + ';setupIframesTrap();';
							// doc.head.prepend(script);
						}
					};
					// attach event; contentWindow.frameElement is the <iframe>
					const frame = contentWindow.frameElement;
					if (frame) {
						// If already loaded, inject immediately. Otherwise, onload.
						if (
							frame.contentDocument?.readyState === 'complete' ||
							frame.contentDocument?.readyState === 'interactive'
						) {
							injectScript();
						} else {
							frame.addEventListener('load', injectScript, {
								capture: true,
								once: true,
							});
						}
					}
				}
				return new Proxy(contentWindow, {
					get(target, prop, receiver) {
						if (prop === 'document') {
							return iframe.contentDocument;
						}
						console.log('Get contentWindow property', prop);
						return target[prop];
					},
				});
			},
			set(v) {
				Element.prototype.setAttribute.call(
					this,
					'contentWindow',
					String(v)
				);
			},
		});

		Object.defineProperty(HTMLIFrameElement.prototype, 'contentDocument', {
			configurable: true,
			enumerable: Native.contentDocument?.enumerable ?? true,
			get() {
				// console.trace('intercepting iframe contentDocument get', this);
				const contentDocument = Native.contentDocument.get.call(this);

				if (contentDocument) {
					// contentDocument is available; inject the script if possible
					const injectScript = () => {
						const doc = contentDocument;
						// console.log('pre inject script (contentDocument)', doc);
						if (doc && doc.head) {
							// console.log('injecting script', setupIframesTrap);
							// const script = document.createElement('script');
							// script.src =
							// 	setupIframesTrap + ';setupIframesTrap();';
							// doc.head.prepend(script);
						}
					};

					// this is the <iframe>
					const frame = this;
					if (
						contentDocument?.readyState === 'complete' ||
						contentDocument?.readyState === 'interactive'
					) {
						injectScript();
					} else {
						frame.addEventListener('load', injectScript, {
							capture: true,
							once: true,
						});
					}
				}

				return new Proxy(contentDocument, {
					get(target, prop, receiver) {
						console.log('Get contentDocument property', prop);
						if (prop === 'write') {
							return function (source) {
								if (!source.includes('setupIframesTrap')) {
									source = source.replace(
										/<head>/g,
										'<head><base href="' +
											document.baseURI +
											'"><script>' +
											setupIframesTrap +
											';setupIframesTrap();</' +
											'script>'
									);
								}
								return contentDocument.write(source);
								// throw new Error(
								// 	'document.write is disabled on this contentDocument'
								// );
							};
						}
						console.log({ contentDocument, prop, receiver });
						const value = contentDocument[prop];
						return typeof value === 'function'
							? value.bind(target)
							: value;
					},
				});
			},
			set(v) {
				Element.prototype.setAttribute.call(
					this,
					'contentDocument',
					String(v)
				);
			},
		});

		// 4) Catch iframes added via innerHTML, templating, etc.
		const mutationObserver = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				for (const node of mutation.addedNodes) {
					if (node instanceof HTMLIFrameElement) {
						// console.log('intercepting iframe added', node);
						if (
							!node.hasAttribute('src') &&
							!node.hasAttribute('srcdoc')
						) {
							const { LOADER_PATH } =
								scopedPaths(inferredSiteScope);
							const url = `${LOADER_PATH}#${new URLSearchParams({
								base: document.baseURI,
							}).toString()}`;
							setIframeSrc(node, url);
							node.setAttribute('data-controlled', '1');
						} else {
							const base = document.createElement('base');
							base.setAttribute('href', document.baseURI);
							node.contentDocument.head.prepend(base);
						}
					} else if (node instanceof Element) {
						node.querySelectorAll(
							'iframe:not([src]):not([srcdoc])'
						).forEach((iframe) => {
							console.log(
								'intercepting iframe added element',
								iframe
							);
							const { LOADER_PATH } =
								scopedPaths(inferredSiteScope);
							const url = `${LOADER_PATH}#${new URLSearchParams({
								base: document.baseURI,
							}).toString()}`;
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

		// Anti-flash while the rewrite happens.
		const style = document.createElement('style');
		style.textContent = `iframe{visibility:hidden} iframe[data-controlled="1"]{visibility:visible}`;
		document.documentElement.appendChild(style);
	}
}

setupIframesTrap();
