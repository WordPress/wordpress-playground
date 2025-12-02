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
	 *
	 * The scope can appear in two forms:
	 * 1. At path start: /scope:xxx/...  (direct access)
	 * 2. After SW prefix: /website-server/scope:xxx/...  (when running under /website-server/)
	 *
	 * We extract everything up to and including the /scope:xxx segment to ensure
	 * loader URLs stay within the service worker's scope.
	 */
	const inferredSiteScope =
		document.currentScript?.dataset.scope ||
		location.pathname.match(/^(.*\/scope:[^/]+)/)?.[1] ||
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
	 * For cross-realm iframes (created in ancestor documents), we need to use
	 * the ancestor's native setter, not our captured one. This is important for
	 * Firefox which doesn't allow cross-realm property setter calls.
	 */
	function setIframeSrc(iframe, url, ancestorWindow) {
		// If an ancestor window is provided (cross-realm case), get that realm's native setter
		if (ancestorWindow && ancestorWindow !== window) {
			try {
				const ancestorSetter = Object.getOwnPropertyDescriptor(
					ancestorWindow.HTMLIFrameElement.prototype,
					'src'
				)?.set;
				if (ancestorSetter) {
					ancestorSetter.call(iframe, url);
					return;
				}
			} catch {
				// Fall through to other methods
			}
			// Fallback: use setAttribute from the ancestor's Element prototype
			try {
				ancestorWindow.Element.prototype.setAttribute.call(iframe, 'src', url);
				return;
			} catch {
				// Fall through to native setAttribute
			}
		}
		// Same-realm case or fallback
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
	 * In nested contexts where direct iframe navigation doesn't work, we delegate
	 * to a capable ancestor window.
	 */
	async function rewriteSrcdoc(iframe, html, opts = {}) {
		// Mark that srcdoc processing is in progress (so scheduleIframeControl can defer)
		iframe.setAttribute('data-srcdoc-pending', '1');

		const id = uid();
		await cacheIframeContents(id, html);
		const url = await toLoaderUrl({ id, ...opts });

		// In nested contexts, direct setIframeSrc doesn't trigger navigation
		// We need to use the parent-delegation approach
		if (isNestedContext()) {
			const capableAncestor = findCapableAncestor();
			if (capableAncestor) {
				// Schedule the control with the loader URL already prepared.
				// NOTE: We keep data-srcdoc-pending set until scheduleSrcdocControl completes.
				// This prevents scheduleIframeControl from creating a duplicate controlled iframe.
				scheduleSrcdocControl(iframe, url);
				return;
			}
		}

		// In top-level context or no capable ancestor, set src directly
		setIframeSrc(iframe, url);
		iframe.setAttribute('data-controlled', '1');
		iframe.removeAttribute('data-srcdoc-pending');
	}

	/**
	 * Schedule srcdoc iframe control using the parent-delegation approach.
	 * Similar to scheduleIframeControl but for iframes that have srcdoc content
	 * which has already been cached and converted to a loader URL.
	 */
	function scheduleSrcdocControl(iframe, loaderUrl) {
		// Mark as pending control
		iframe.setAttribute('data-control-pending', '1');

		const tryControl = () => {
			// Only proceed if iframe is still in the document
			if (!iframe.isConnected) {
				requestAnimationFrame(tryControl);
				return;
			}

			// Only proceed if not already controlled
			if (iframe.getAttribute('data-controlled') === '1') {
				iframe.removeAttribute('data-control-pending');
				return;
			}

			const capableAncestor = findCapableAncestor();
			if (!capableAncestor) {
				// No capable ancestor, try direct assignment (may not work)
				setIframeSrc(iframe, loaderUrl);
				iframe.setAttribute('data-controlled', '1');
				iframe.removeAttribute('data-control-pending');
				iframe.removeAttribute('data-srcdoc-pending');
				return;
			}

			// Generate unique ID for cross-document reference
			const iframeId = `pg-iframe-${uid()}`;
			iframe.id = iframe.id || iframeId;
			const finalId = iframe.id;

			// Create controlled iframe in ancestor's document
			// Use the native createElement to bypass our handleCreateElement wrapper
			// which would otherwise set a default loader URL
			const ancestorDoc = capableAncestor.document;
			const ancestorNativeCreate = ancestorDoc.__playground_native_createElement || Native.createElement;
			const controlledIframe = ancestorNativeCreate.call(ancestorDoc, 'iframe');
			controlledIframe.id = `${finalId}-controlled`;

			// Copy attributes from original iframe (except src/srcdoc/control markers)
			for (const attr of iframe.attributes) {
				if (attr.name !== 'src' && attr.name !== 'srcdoc' && attr.name !== 'data-control-pending' && attr.name !== 'data-controlled' && attr.name !== 'id') {
					controlledIframe.setAttribute(attr.name, attr.value);
				}
			}

			// Position the controlled iframe to overlay the original
			const updatePosition = () => {
				try {
					if (!iframe.isConnected) {
						controlledIframe.remove();
						return;
					}
					const rect = iframe.getBoundingClientRect();
					let offsetTop = 0;
					let offsetLeft = 0;
					let win = window;
					while (win !== capableAncestor && win.frameElement) {
						const frameRect = win.frameElement.getBoundingClientRect();
						offsetTop += frameRect.top;
						offsetLeft += frameRect.left;
						win = win.parent;
					}
					controlledIframe.style.position = 'fixed';
					controlledIframe.style.top = `${rect.top + offsetTop}px`;
					controlledIframe.style.left = `${rect.left + offsetLeft}px`;
					controlledIframe.style.width = `${rect.width}px`;
					controlledIframe.style.height = `${rect.height}px`;
					controlledIframe.style.zIndex = '999999';
					controlledIframe.style.border = iframe.style.border || 'none';
					requestAnimationFrame(updatePosition);
				} catch {
					// If we can't access the iframe anymore, stop updating
				}
			};

			// Hide the original iframe
			iframe.style.visibility = 'hidden';

			// Append to ancestor document BEFORE setting src
			// (iframe must be in DOM for navigation to work)
			ancestorDoc.body.appendChild(controlledIframe);
			updatePosition();

			// Now set the loader URL - this must happen AFTER appendChild
			// to ensure the iframe navigates properly.
			// Pass capableAncestor for cross-realm iframe src setting (Firefox compatibility)
			setIframeSrc(controlledIframe, loaderUrl, capableAncestor);

			// Mark original as controlled
			iframe.setAttribute('data-controlled', '1');
			iframe.setAttribute('data-controlled-by', controlledIframe.id);
			iframe.removeAttribute('data-control-pending');
			iframe.removeAttribute('data-srcdoc-pending');

			// Store reference for contentWindow/contentDocument access
			iframe.__controlledIframe = controlledIframe;
		};

		requestAnimationFrame(tryControl);
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

	/**
	 * Check if we're in a nested iframe context by looking at the frame hierarchy.
	 * Nested contexts (srcdoc iframes that went through the loader) have trouble
	 * with synchronous iframe navigation.
	 */
	function isNestedContext() {
		try {
			// If we're not in the top frame, we might be nested
			return window !== window.top;
		} catch {
			// Cross-origin access error means we're definitely nested
			return true;
		}
	}

	/**
	 * Find the topmost ancestor window that can successfully create controlled iframes.
	 * Returns null if no suitable ancestor is found.
	 *
	 * We go all the way to the top because:
	 * 1. The topmost SW-controlled page is the most reliable for iframe navigation
	 * 2. With arbitrary nesting depth, intermediate frames might also be srcdoc-based
	 *    and unable to navigate iframes properly
	 * 3. Positioning calculations already handle multi-level offset accumulation
	 */
	function findCapableAncestor() {
		let topmost = null;
		try {
			let current = window;
			while (current.parent && current.parent !== current) {
				try {
					// Check if parent is accessible (same-origin)
					const parentDoc = current.parent.document;
					if (parentDoc) {
						// Check if this ancestor is SW-controlled
						// This is the best indicator that iframes created here will work
						if (current.parent.navigator?.serviceWorker?.controller) {
							topmost = current.parent;
						} else if (!topmost && parentDoc.body) {
							// Fall back to any accessible ancestor if none are SW-controlled yet
							topmost = current.parent;
						}
					}
				} catch {
					// Cross-origin, can't use this parent
					break;
				}
				current = current.parent;
			}
		} catch {
			// Ignore errors traversing frame hierarchy
		}
		return topmost;
	}

	/**
	 * Schedule iframe control for the next browser task.
	 * This is necessary for nested contexts where synchronous src assignment
	 * doesn't trigger navigation during script execution.
	 *
	 * The solution: delegate iframe creation to an ancestor window that CAN
	 * successfully trigger iframe navigation. The iframe is created in the
	 * parent's DOM but can be accessed by the child.
	 */
	function scheduleIframeControl(iframe) {
		// Mark as pending control
		iframe.setAttribute('data-control-pending', '1');

		// Wait until the iframe is connected to the DOM
		const tryControl = () => {
			// Check if srcdoc processing has started OR already completed - these take priority.
			// We check for:
			// - data-srcdoc-pending: srcdoc is being processed right now
			// - data-controlled-by: srcdoc processing completed and created a controlled iframe
			// - __controlledIframe: the controlled iframe reference is set
			// We check these before isConnected because srcdoc can be set at any time.
			const srcdocPending = iframe.getAttribute('data-srcdoc-pending') === '1';
			const hasControlledBy = iframe.getAttribute('data-controlled-by');
			const hasControlledRef = !!iframe.__controlledIframe;
			if (srcdocPending || hasControlledBy || hasControlledRef) {
				// srcdoc is being handled or was already handled, bail out completely
				iframe.removeAttribute('data-control-pending');
				return;
			}

			// Only proceed if iframe is still in the document
			if (!iframe.isConnected) {
				// Retry later if not yet connected
				requestAnimationFrame(tryControl);
				return;
			}

			// Only proceed if not already controlled
			if (iframe.getAttribute('data-controlled') === '1') {
				iframe.removeAttribute('data-control-pending');
				return;
			}

			// Check if user has set a real src/srcdoc in the meantime
			// Note: we also check data-srcdoc-pending because our setAttribute wrapper
			// intercepts srcdoc and doesn't set the actual attribute
			const currentSrc = iframe.getAttribute('src') || '';
			const currentSrcdoc = iframe.getAttribute('srcdoc');
			if (currentSrcdoc || (currentSrc && currentSrc !== '' && currentSrc !== 'about:blank')) {
				// User set something, let the normal handlers deal with it
				iframe.removeAttribute('data-control-pending');
				return;
			}

			// Find an ancestor that can create controlled iframes
			const capableAncestor = findCapableAncestor();
			if (!capableAncestor) {
				// No capable ancestor, fall back to local creation (may not work)
				const url = getEmptyLoaderUrl();
				setIframeSrc(iframe, url);
				iframe.setAttribute('data-controlled', '1');
				iframe.removeAttribute('data-control-pending');
				return;
			}

			// Generate unique ID for cross-document reference
			const iframeId = `pg-iframe-${uid()}`;
			iframe.id = iframe.id || iframeId;
			const finalId = iframe.id;

			// Create controlled iframe in ancestor's document
			// Use native createElement to bypass our wrapper which sets default src
			const ancestorDoc = capableAncestor.document;
			const ancestorNativeCreate = ancestorDoc.__playground_native_createElement || Native.createElement;
			const controlledIframe = ancestorNativeCreate.call(ancestorDoc, 'iframe');
			controlledIframe.id = `${finalId}-controlled`;

			// Copy attributes from original iframe
			for (const attr of iframe.attributes) {
				if (attr.name !== 'src' && attr.name !== 'data-control-pending' && attr.name !== 'id') {
					controlledIframe.setAttribute(attr.name, attr.value);
				}
			}

			// Position the controlled iframe to overlay the original
			// Use position:fixed and calculate based on original's position
			const updatePosition = () => {
				try {
					if (!iframe.isConnected) {
						// Original removed, clean up controlled iframe
						controlledIframe.remove();
						return;
					}
					const rect = iframe.getBoundingClientRect();
					// Get the offset of the child window relative to the ancestor
					let offsetTop = 0;
					let offsetLeft = 0;
					let win = window;
					while (win !== capableAncestor && win.frameElement) {
						const frameRect = win.frameElement.getBoundingClientRect();
						offsetTop += frameRect.top;
						offsetLeft += frameRect.left;
						win = win.parent;
					}
					controlledIframe.style.position = 'fixed';
					controlledIframe.style.top = `${rect.top + offsetTop}px`;
					controlledIframe.style.left = `${rect.left + offsetLeft}px`;
					controlledIframe.style.width = `${rect.width}px`;
					controlledIframe.style.height = `${rect.height}px`;
					controlledIframe.style.zIndex = '999999';
					controlledIframe.style.border = iframe.style.border || 'none';

					// Continue updating position
					requestAnimationFrame(updatePosition);
				} catch {
					// If we can't access the iframe anymore, stop updating
				}
			};

			// Hide the original iframe (it won't be used for content)
			iframe.style.visibility = 'hidden';

			// Append to ancestor document BEFORE setting src
			// (iframe must be in DOM for navigation to work)
			ancestorDoc.body.appendChild(controlledIframe);
			updatePosition();

			// Now set the loader URL - this must happen AFTER appendChild.
			// Pass capableAncestor for cross-realm iframe src setting (Firefox compatibility)
			const url = getEmptyLoaderUrl();
			setIframeSrc(controlledIframe, url, capableAncestor);

			// Mark original as controlled (even though actual content is elsewhere)
			iframe.setAttribute('data-controlled', '1');
			iframe.setAttribute('data-controlled-by', controlledIframe.id);
			iframe.removeAttribute('data-control-pending');

			// Store reference for contentWindow/contentDocument access
			iframe.__controlledIframe = controlledIframe;
		};

		// Defer to next animation frame for better timing
		requestAnimationFrame(tryControl);
	}

	function handleCreateElement(element, args) {
		const tagName = args[0];
		if (String(tagName).toLowerCase() !== 'iframe') {
			return element;
		}

		const iframe = element;
		try {
			const { LOADER_PATH } = scopedPaths(inferredSiteScope);
			// Only seed if no src/srcdoc is set and not already controlled
			const alreadyControlled = iframe.getAttribute('data-controlled') === '1';
			const srcdocPending = iframe.getAttribute('data-srcdoc-pending') === '1';
			if (!alreadyControlled && !srcdocPending && !iframe.hasAttribute('src') && !iframe.hasAttribute('srcdoc') && LOADER_PATH) {
				if (isNestedContext()) {
					// In nested contexts, defer the src assignment to allow navigation
					scheduleIframeControl(iframe);
				} else {
					// In top-level context, set src synchronously
					const url = getEmptyLoaderUrl();
					setIframeSrc(iframe, url);
					iframe.setAttribute('data-controlled', '1');
				}
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
					// Mark as pending BEFORE starting async fetch to prevent
					// scheduleIframeControl from treating this as a blank iframe
					this.setAttribute('data-srcdoc-pending', '1');
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
	// contentWindow/contentDocument getters - redirect to controlled iframe if needed
	// ============================================================================
	Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
		configurable: true,
		enumerable: Native.contentWindow?.enumerable ?? true,
		get() {
			// If this iframe has a controlled counterpart in an ancestor, use that
			if (this.__controlledIframe) {
				try {
					return Native.contentWindow.get.call(this.__controlledIframe);
				} catch {
					// Fall through to native
				}
			}
			return Native.contentWindow.get.call(this);
		},
	});

	Object.defineProperty(HTMLIFrameElement.prototype, 'contentDocument', {
		configurable: true,
		enumerable: Native.contentDocument?.enumerable ?? true,
		get() {
			// If this iframe has a controlled counterpart in an ancestor, use that
			if (this.__controlledIframe) {
				try {
					return Native.contentDocument.get.call(this.__controlledIframe);
				} catch {
					// Fall through to native
				}
			}
			return Native.contentDocument.get.call(this);
		},
	});

	/**
	 * Control an iframe that was just added to the DOM.
	 * Uses deferred approach for nested contexts.
	 */
	function controlIframeOnMutation(iframe) {
		if (iframe.hasAttribute('src') || iframe.hasAttribute('srcdoc')) {
			return;
		}
		if (iframe.getAttribute('data-controlled') === '1' || iframe.getAttribute('data-control-pending') === '1') {
			return;
		}
		if (isNestedContext()) {
			scheduleIframeControl(iframe);
		} else {
			const url = getEmptyLoaderUrl();
			setIframeSrc(iframe, url);
			iframe.setAttribute('data-controlled', '1');
		}
	}

	// ============================================================================
	// MutationObserver - catches iframes added via innerHTML, templating, etc.
	// ============================================================================
	const mutationObserver = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of mutation.addedNodes) {
				if (node instanceof HTMLIFrameElement) {
					controlIframeOnMutation(node);
				} else if (node instanceof Element) {
					node.querySelectorAll('iframe').forEach((iframe) => {
						controlIframeOnMutation(iframe);
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
