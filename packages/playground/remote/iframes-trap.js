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

	/**
	 * Inject iframes-trap.js into an iframe's document WITHOUT navigating.
	 * This is used for document.write() iframes where we want to preserve
	 * the existing document (and all references to it) while still ensuring
	 * nested iframes will be controlled.
	 *
	 * Returns a promise that resolves when the script has loaded.
	 */
	async function injectIframesTrapIntoDocument(iframe) {
		const doc = iframe.contentDocument;
		if (!doc || !doc.head) {
			console.log('[iframes-trap] injectIframesTrapIntoDocument: no document or head');
			return false;
		}

		// Check if already injected
		if (iframe.contentWindow?.__controlled_iframes_loaded__) {
			console.log('[iframes-trap] injectIframesTrapIntoDocument: already loaded');
			return true;
		}

		const scope = await scopePromise;
		const { TRAP_SCRIPT_URL } = scopedPaths(scope);

		// Add base tag if not present (needed for relative URLs)
		if (!doc.querySelector('base')) {
			const base = doc.createElement('base');
			base.href = document.baseURI;
			doc.head.insertBefore(base, doc.head.firstChild);
		}

		// Create and inject the script
		return new Promise((resolve) => {
			const script = doc.createElement('script');
			script.src = TRAP_SCRIPT_URL;
			script.onload = () => {
				console.log('[iframes-trap] injectIframesTrapIntoDocument: script loaded');
				iframe.setAttribute('data-docwrite-controlled', '1');
				resolve(true);
			};
			script.onerror = () => {
				console.warn('[iframes-trap] injectIframesTrapIntoDocument: script failed to load');
				resolve(false);
			};
			doc.head.appendChild(script);
		});
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
	 * Store iframe HTML content in CacheStorage.
	 *
	 * IMPORTANT: We inject iframes-trap.js and a <base> tag directly into the HTML
	 * so that when the SW serves this content, it's a complete, real HTML document.
	 * This is critical because documents served this way allow nested iframe
	 * navigation to work properly (unlike innerHTML-injected documents).
	 *
	 * @param {string} id - Unique ID for this cached content
	 * @param {string} html - The original HTML content
	 * @param {string} base - The base URL for relative URLs in the document
	 * @param {string} prettyUrl - Optional URL to show in the browser (for history.replaceState)
	 */
	async function cacheIframeContents(id, html, base = document.baseURI, prettyUrl = '') {
		const cache = await caches.open(iframeCacheBucket);
		const scope = await scopePromise;
		const { VIRTUAL_PREFIX, TRAP_SCRIPT_URL } = scopedPaths(scope);

		// Rewrite absolute URLs to include the SW scope prefix
		// This ensures CSS, images, and scripts load through the SW
		const rewrittenHtml = rewriteAbsoluteUrlsInHtml(html, scope);

		// Inject iframes-trap.js and base tag into the HTML
		// This makes the cached document a complete, self-contained HTML page
		// that sets up iframe control for any nested iframes
		const injectedHtml = injectScriptsIntoHtml(rewrittenHtml, TRAP_SCRIPT_URL, base, prettyUrl);

		await cache.put(
			`${VIRTUAL_PREFIX}${id}.html`,
			new Response(injectedHtml, {
				headers: { 'Content-Type': 'text/html; charset=utf-8' },
			})
		);
	}

	/**
	 * Inject iframes-trap.js script and base tag into HTML.
	 * This transforms srcdoc HTML into a complete document that can control nested iframes.
	 */
	function injectScriptsIntoHtml(html, trapScriptUrl, base, prettyUrl) {
		// Find where to inject (after <head> or at start of document)
		let injectionPoint = 0;
		let prefix = '';

		// Try to find <head> tag
		const headMatch = html.match(/<head[^>]*>/i);
		if (headMatch) {
			injectionPoint = headMatch.index + headMatch[0].length;
		} else {
			// No <head> tag - inject after doctype/html or at start
			const htmlMatch = html.match(/<html[^>]*>/i);
			if (htmlMatch) {
				injectionPoint = htmlMatch.index + htmlMatch[0].length;
				prefix = '<head>';
			} else {
				// No <html> tag either - inject at start with full structure
				prefix = '<!DOCTYPE html><html><head>';
			}
		}

		// Build the injection content
		const baseTag = `<base href="${escapeHtml(base)}">`;
		const scriptTag = `<script src="${escapeHtml(trapScriptUrl)}"></script>`;

		// Add a small script to update the URL if prettyUrl is provided
		const urlScript = prettyUrl
			? `<script>history.replaceState({}, '', ${JSON.stringify(prettyUrl)});</script>`
			: '';

		const injection = prefix + baseTag + scriptTag + urlScript;

		// Close head if we opened it
		const suffix = prefix.includes('<head>') ? '</head>' : '';

		return html.slice(0, injectionPoint) + injection + html.slice(injectionPoint) + suffix;
	}

	/**
	 * Escape HTML special characters for safe attribute insertion.
	 */
	function escapeHtml(str) {
		return str
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	/**
	 * Rewrite absolute URLs in HTML to include the SW scope prefix.
	 *
	 * TinyMCE and other libraries use absolute paths like "/wp-includes/css/..."
	 * which resolve against the origin, NOT the base tag. This means they bypass
	 * the Service Worker scope (e.g., /website-server/).
	 *
	 * This function rewrites absolute paths to include the scope prefix, ensuring
	 * they go through the SW.
	 *
	 * Example: href="/scope:test/file.css" -> href="/website-server/scope:test/file.css"
	 */
	function rewriteAbsoluteUrlsInHtml(html, scope) {
		if (!scope) return html;

		// The scope already includes the path prefix (e.g., "/website-server/scope:test")
		// We need to extract the prefix before "scope:" to prepend it to absolute URLs
		// that contain "scope:" but don't have the prefix

		// Find the prefix before scope: (e.g., "/website-server")
		const scopeMatch = scope.match(/^(.*?)(\/scope:[^/]*)/);
		if (!scopeMatch) return html; // No scope pattern, nothing to rewrite

		const prefix = scopeMatch[1]; // e.g., "/website-server"
		if (!prefix) return html; // No prefix, URLs are already correct

		// Rewrite src and href attributes that start with "/" but don't include the prefix
		// Match: src="/scope:..." or href="/scope:..." (without the prefix)
		// But NOT: src="/website-server/scope:..." (already has prefix)
		const pattern = new RegExp(
			`((?:src|href|action)\\s*=\\s*["'])(\\/(?!${prefix.slice(1)}\\/))`,
			'gi'
		);

		return html.replace(pattern, (match, attrStart, pathStart) => {
			return attrStart + prefix + pathStart;
		});
	}

	/**
	 * Build a URL to the cached iframe content.
	 *
	 * Instead of using a loader page that fetches and injects cached content via
	 * innerHTML, we navigate directly to the cached content URL. The SW serves
	 * the cached HTML directly, which creates a "real" document where nested
	 * iframe navigation works properly.
	 */
	async function toLoaderUrl({ id, prettyUrl = '', base = document.baseURI } = {}) {
		const scope = await scopePromise;
		const { VIRTUAL_PREFIX, LOADER_PATH } = scopedPaths(scope);

		// If we have an ID, navigate directly to the cached content
		// This is crucial for nested iframes to work properly
		if (id) {
			return `${VIRTUAL_PREFIX}${id}.html`;
		}

		// No ID - use the loader for empty iframes
		// (shouldn't normally happen since empty iframes get cached too)
		const queryString = new URLSearchParams({ base, url: prettyUrl });
		return `${LOADER_PATH}#${queryString.toString()}`;
	}

	/**
	 * Rewrite an iframe's srcdoc by caching the HTML and navigating to the cached URL.
	 * This navigates the original iframe to a SW-controlled URL.
	 *
	 * The HTML is injected with iframes-trap.js and a <base> tag, then cached.
	 * The iframe navigates directly to the cached URL, which the SW serves as
	 * a real HTML document. This allows nested iframes to work properly.
	 */
	async function rewriteSrcdoc(iframe, html, opts = {}) {
		console.log('[iframes-trap] rewriteSrcdoc called, html length:', html?.length);

		// Mark that srcdoc processing is in progress (so scheduleIframeControl can defer)
		iframe.setAttribute('data-srcdoc-pending', '1');

		const id = uid();
		const base = opts.base || document.baseURI;
		const prettyUrl = opts.prettyUrl || '';

		console.log('[iframes-trap] rewriteSrcdoc: caching with id:', id);
		// Cache the HTML with injected scripts
		await cacheIframeContents(id, html, base, prettyUrl);
		const url = await toLoaderUrl({ id, ...opts });
		console.log('[iframes-trap] rewriteSrcdoc: loader URL:', url);

		// Remove and re-add the iframe to force a full navigation.
		// This is necessary because:
		// 1. Setting src on an iframe that has had document.write() may not trigger navigation
		// 2. Hash-only URL changes don't trigger navigation
		const parent = iframe.parentNode;
		const nextSibling = iframe.nextSibling;
		console.log('[iframes-trap] rewriteSrcdoc: parent:', !!parent, 'nextSibling:', !!nextSibling);

		// Temporarily remove from DOM
		if (parent) {
			parent.removeChild(iframe);
		}

		// Set src using native setter
		console.log('[iframes-trap] rewriteSrcdoc: setting src to:', url);
		setIframeSrc(iframe, url);

		// Re-add to DOM - this triggers a fresh navigation
		if (parent) {
			if (nextSibling) {
				parent.insertBefore(iframe, nextSibling);
			} else {
				parent.appendChild(iframe);
			}
		}

		console.log('[iframes-trap] rewriteSrcdoc: done, iframe.src:', iframe.src);
		iframe.setAttribute('data-controlled', '1');
		iframe.removeAttribute('data-srcdoc-pending');
	}

	/**
	 * Schedule srcdoc iframe control using the parent-delegation approach.
	 * Similar to scheduleIframeControl but for iframes that have srcdoc content
	 * which has already been cached and converted to a loader URL.
	 *
	 * Uses message passing to create iframes in ancestor windows to work around
	 * Firefox's cross-realm restrictions.
	 */
	function scheduleSrcdocControl(iframe, loaderUrl) {
		// If this iframe was already controlled (e.g., by controlIframeOnMutation for blank iframe
		// before document.write() was called), we need to remove the old controlled iframe
		// because the content has changed.
		if (iframe.__controlledIframe) {
			try {
				iframe.__controlledIframe.remove();
			} catch {
				// Ignore removal errors
			}
			iframe.__controlledIframe = null;
			iframe.removeAttribute('data-controlled');
			iframe.removeAttribute('data-controlled-by');
		}

		// Mark as pending control
		iframe.setAttribute('data-control-pending', '1');

		const tryControl = async () => {
			// Only proceed if iframe is still in the document
			if (!iframe.isConnected) {
				requestAnimationFrame(tryControl);
				return;
			}

			const capableAncestor = findCapableAncestor();

			// Clean up any existing controlled iframe before creating a new one
			// This handles the case where scheduleIframeControl already created one
			// before document.write() was called.
			const existingControlledId = iframe.getAttribute('data-controlled-by');
			if (existingControlledId || iframe.__controlledIframe) {
				// Remove via reference
				if (iframe.__controlledIframe) {
					try {
						iframe.__controlledIframe.remove();
					} catch {
						// Ignore
					}
					iframe.__controlledIframe = null;
				}
				// Also try to find and remove by ID in the capable ancestor (where it was likely created)
				if (existingControlledId && capableAncestor) {
					try {
						const existing = capableAncestor.document.getElementById(existingControlledId);
						if (existing) {
							existing.remove();
							// Also clean up from __pg_iframes registry
							if (capableAncestor.__pg_iframes?.[existingControlledId]) {
								delete capableAncestor.__pg_iframes[existingControlledId];
							}
						}
					} catch {
						// Cross-origin or not found
					}
				}
				iframe.removeAttribute('data-controlled');
				iframe.removeAttribute('data-controlled-by');
			}
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
			const controlledId = `${finalId}-controlled`;

			// Collect attributes to copy (except src/srcdoc/control markers)
			const attributes = {};
			for (const attr of iframe.attributes) {
				if (attr.name !== 'src' && attr.name !== 'srcdoc' && attr.name !== 'data-control-pending' && attr.name !== 'data-controlled' && attr.name !== 'data-srcdoc-pending' && attr.name !== 'id') {
					attributes[attr.name] = attr.value;
				}
			}

			// Calculate position for the controlled iframe
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

			const style = {
				position: 'fixed',
				top: `${rect.top + offsetTop}px`,
				left: `${rect.left + offsetLeft}px`,
				width: `${rect.width}px`,
				height: `${rect.height}px`,
				zIndex: '999999',
				border: iframe.style.border || 'none',
			};

			try {
				// Use message passing to create the iframe in the ancestor's realm
				// This is critical for Firefox compatibility
				const controlledIframe = await requestAncestorCreateIframe(capableAncestor, {
					id: controlledId,
					src: loaderUrl,
					attributes,
					style,
				});

				// Hide the original iframe
				iframe.style.visibility = 'hidden';

				// Set up position updates
				const updatePosition = () => {
					try {
						if (!iframe.isConnected) {
							controlledIframe.remove();
							return;
						}
						const newRect = iframe.getBoundingClientRect();
						let newOffsetTop = 0;
						let newOffsetLeft = 0;
						let w = window;
						while (w !== capableAncestor && w.frameElement) {
							const frameRect = w.frameElement.getBoundingClientRect();
							newOffsetTop += frameRect.top;
							newOffsetLeft += frameRect.left;
							w = w.parent;
						}
						controlledIframe.style.top = `${newRect.top + newOffsetTop}px`;
						controlledIframe.style.left = `${newRect.left + newOffsetLeft}px`;
						controlledIframe.style.width = `${newRect.width}px`;
						controlledIframe.style.height = `${newRect.height}px`;
						requestAnimationFrame(updatePosition);
					} catch {
						// If we can't access the iframe anymore, stop updating
					}
				};
				requestAnimationFrame(updatePosition);

				// Mark original as controlled
				iframe.setAttribute('data-controlled', '1');
				iframe.setAttribute('data-controlled-by', controlledId);
				iframe.removeAttribute('data-control-pending');
				iframe.removeAttribute('data-srcdoc-pending');

				// Store reference for contentWindow/contentDocument access
				iframe.__controlledIframe = controlledIframe;
			} catch (error) {
				// Message passing failed, fall back to direct approach (might not work in Firefox)
				console.warn('[iframes-trap] Message-based iframe creation failed, falling back to direct approach:', error);

				const ancestorDoc = capableAncestor.document;
				const ancestorNativeCreate = ancestorDoc.__playground_native_createElement || Native.createElement;
				const controlledIframe = ancestorNativeCreate.call(ancestorDoc, 'iframe');
				controlledIframe.id = controlledId;

				for (const [name, value] of Object.entries(attributes)) {
					controlledIframe.setAttribute(name, value);
				}
				Object.assign(controlledIframe.style, style);

				iframe.style.visibility = 'hidden';
				ancestorDoc.body.appendChild(controlledIframe);
				setIframeSrc(controlledIframe, loaderUrl, capableAncestor);

				// Position updates
				const updatePosition = () => {
					try {
						if (!iframe.isConnected) {
							controlledIframe.remove();
							return;
						}
						const newRect = iframe.getBoundingClientRect();
						let newOffsetTop = 0;
						let newOffsetLeft = 0;
						let w = window;
						while (w !== capableAncestor && w.frameElement) {
							const frameRect = w.frameElement.getBoundingClientRect();
							newOffsetTop += frameRect.top;
							newOffsetLeft += frameRect.left;
							w = w.parent;
						}
						controlledIframe.style.top = `${newRect.top + newOffsetTop}px`;
						controlledIframe.style.left = `${newRect.left + newOffsetLeft}px`;
						controlledIframe.style.width = `${newRect.width}px`;
						controlledIframe.style.height = `${newRect.height}px`;
						requestAnimationFrame(updatePosition);
					} catch {
						// Stop updating if we can't access the iframe
					}
				};
				requestAnimationFrame(updatePosition);

				iframe.setAttribute('data-controlled', '1');
				iframe.setAttribute('data-controlled-by', controlledId);
				iframe.removeAttribute('data-control-pending');
				iframe.removeAttribute('data-srcdoc-pending');
				iframe.__controlledIframe = controlledIframe;
			}
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
	// Cross-realm iframe creation via message passing (Firefox compatibility)
	// ============================================================================
	// In Firefox, cross-realm property setter calls fail silently. To work around this,
	// we use postMessage to ask the ancestor window to create iframes entirely within
	// its own realm. The child frame posts a message requesting iframe creation, and
	// the ancestor creates the iframe and sends back a reference via a MessageChannel.

	/**
	 * Ask an ancestor window to create a controlled iframe.
	 * Returns a promise that resolves with the created iframe element.
	 */
	function requestAncestorCreateIframe(ancestorWindow, config) {
		console.log('[iframes-trap] Requesting ancestor to create iframe:', config.id, config.src);

		return new Promise((resolve, reject) => {
			const channel = new MessageChannel();
			const timeout = setTimeout(() => {
				console.error('[iframes-trap] Ancestor iframe creation timed out:', config.id);
				reject(new Error('Ancestor iframe creation timed out'));
			}, 15000); // Increased timeout for Firefox

			channel.port1.onmessage = (event) => {
				clearTimeout(timeout);
				console.log('[iframes-trap] Received response for iframe:', config.id, event.data);
				if (event.data.error) {
					reject(new Error(event.data.error));
				} else {
					// The ancestor stores the iframe reference on window.__pg_iframes
					const iframe = ancestorWindow.__pg_iframes?.[event.data.iframeId];
					if (iframe) {
						console.log('[iframes-trap] Found iframe reference:', config.id);
						resolve(iframe);
					} else {
						console.error('[iframes-trap] Iframe reference not found:', event.data.iframeId);
						reject(new Error('Iframe reference not found'));
					}
				}
			};

			ancestorWindow.postMessage(
				{
					type: '__playground_create_iframe',
					config,
				},
				'*',
				[channel.port2]
			);
		});
	}

	/**
	 * Listen for iframe messages from child frames.
	 * This handler runs in the ancestor window's realm.
	 */
	window.addEventListener('message', async (event) => {
		// Handle iframe navigation requests
		if (event.data?.type === '__playground_navigate_iframe') {
			const { iframeId, url } = event.data;
			console.log('[iframes-trap] Received iframe navigation request:', iframeId, url);

			// The child frame stores a reference to the iframe in __pg_iframes_to_navigate
			// We need to find the child window that sent this message and access the iframe
			try {
				// Walk through all child frames to find the one with this iframe
				const findIframeInDescendants = (win, depth = 0) => {
					try {
						const pendingNavs = win.__pg_iframes_to_navigate;
						console.log(`[iframes-trap] findIframeInDescendants depth=${depth}, hasPending=${!!pendingNavs}, looking for ${iframeId}`);
						if (pendingNavs) {
							console.log(`[iframes-trap] pendingNavs keys:`, Object.keys(pendingNavs));
						}
						if (pendingNavs && pendingNavs[iframeId]) {
							console.log(`[iframes-trap] Found at depth ${depth}!`);
							return pendingNavs[iframeId];
						}
						// Search in child frames
						console.log(`[iframes-trap] depth=${depth} has ${win.frames.length} child frames`);
						for (let i = 0; i < win.frames.length; i++) {
							try {
								const result = findIframeInDescendants(win.frames[i], depth + 1);
								if (result) return result;
							} catch (e) {
								console.log(`[iframes-trap] depth=${depth} frame[${i}] cross-origin:`, e.message);
								// Cross-origin child, skip
							}
						}
					} catch (e) {
						console.log(`[iframes-trap] depth=${depth} access error:`, e.message);
						// Cross-origin access error
					}
					return null;
				};

				const found = findIframeInDescendants(window);
				if (found && found.iframe) {
					const { iframe } = found;
					console.log('[iframes-trap] Found iframe to navigate:', iframeId);

					// Try multiple approaches to trigger navigation
					// Approach 1: Try contentWindow.location.href (may fail due to cross-origin)
					try {
						if (iframe.contentWindow) {
							console.log('[iframes-trap] Attempting contentWindow.location navigation');
							iframe.contentWindow.location.href = url;
							console.log('[iframes-trap] contentWindow.location navigation succeeded');
							delete found.iframe.ownerDocument?.defaultView?.__pg_iframes_to_navigate?.[iframeId];
							return;
						}
					} catch (e) {
						console.log('[iframes-trap] contentWindow.location failed:', e.message);
					}

					// Approach 2: Try contentWindow.location.replace (sometimes works when assign doesn't)
					try {
						if (iframe.contentWindow) {
							console.log('[iframes-trap] Attempting contentWindow.location.replace');
							iframe.contentWindow.location.replace(url);
							console.log('[iframes-trap] contentWindow.location.replace succeeded');
							delete found.iframe.ownerDocument?.defaultView?.__pg_iframes_to_navigate?.[iframeId];
							return;
						}
					} catch (e) {
						console.log('[iframes-trap] contentWindow.location.replace failed:', e.message);
					}

					// Approach 3: Remove, set src, and re-add
					console.log('[iframes-trap] Using remove/src/readd approach');
					const parent = iframe.parentNode;
					const nextSibling = iframe.nextSibling;

					if (parent) {
						parent.removeChild(iframe);
					}

					// Set src using native setter - in the ancestor's realm
					if (Native.iframeSrc?.set) {
						Native.iframeSrc.set.call(iframe, url);
					} else {
						Native.setAttribute.call(iframe, 'src', url);
					}

					if (parent) {
						if (nextSibling) {
							parent.insertBefore(iframe, nextSibling);
						} else {
							parent.appendChild(iframe);
						}
					}

					console.log('[iframes-trap] Set src and readded iframe:', iframeId, 'to', url);

					// Clean up the pending navigation entry
					delete found.iframe.ownerDocument?.defaultView?.__pg_iframes_to_navigate?.[iframeId];
				} else {
					console.warn('[iframes-trap] Could not find iframe to navigate:', iframeId);
				}
			} catch (e) {
				console.error('[iframes-trap] Error navigating iframe:', e);
			}
			return;
		}

		// Handle iframe creation requests (existing code)
		if (event.data?.type !== '__playground_create_iframe') {
			return;
		}

		const { config } = event.data;
		const port = event.ports[0];

		if (!port) {
			console.warn('[iframes-trap] Received iframe creation request but no port provided');
			return;
		}

		console.log('[iframes-trap] Received iframe creation request:', config.id, config.src);

		try {
			// Create iframe using this realm's native createElement
			const iframe = Native.createElement.call(document, 'iframe');
			iframe.id = config.id;

			// Copy attributes
			if (config.attributes) {
				for (const [name, value] of Object.entries(config.attributes)) {
					iframe.setAttribute(name, value);
				}
			}

			// Apply styles
			if (config.style) {
				Object.assign(iframe.style, config.style);
			}

			// Append to body
			document.body.appendChild(iframe);

			// Set src using this realm's native setter (critical for Firefox)
			if (config.src) {
				if (Native.iframeSrc?.set) {
					Native.iframeSrc.set.call(iframe, config.src);
				} else {
					Native.setAttribute.call(iframe, 'src', config.src);
				}
			}

			// Store reference so child can access it
			if (!window.__pg_iframes) {
				window.__pg_iframes = {};
			}
			window.__pg_iframes[config.id] = iframe;

			// Wait for the iframe to have a service worker controller before responding.
			// This is critical for Firefox where timing can be different.
			const waitForController = async (maxWait = 10000) => {
				const start = Date.now();
				while (Date.now() - start < maxWait) {
					try {
						if (iframe.contentWindow?.navigator?.serviceWorker?.controller) {
							return true;
						}
					} catch {
						// Cross-origin or not ready
					}
					await new Promise(r => setTimeout(r, 50));
				}
				return false;
			};

			// Wait for controller, but don't block indefinitely
			const hasController = await waitForController();
			console.log('[iframes-trap] Iframe controller ready:', config.id, hasController);

			port.postMessage({ success: true, iframeId: config.id });
		} catch (error) {
			console.error('[iframes-trap] Iframe creation error:', error);
			port.postMessage({ error: error.message });
		}
	});

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
		// We look for the FIRST ancestor that has __controlled_iframes_loaded__ = true,
		// because that means it has the message listener to create controlled iframes.
		// We prefer this over the topmost ancestor because intermediate frames might
		// not have the listener (e.g., remote.html before the service worker injects it).
		let firstCapable = null;
		let fallback = null;
		let depth = 0;
		try {
			let current = window;
			while (current.parent && current.parent !== current) {
				depth++;
				try {
					// Check if parent is accessible (same-origin)
					const parentDoc = current.parent.document;
					if (parentDoc) {
						const hasIframesTrap = current.parent.__controlled_iframes_loaded__ === true;
						const hasSW = !!current.parent.navigator?.serviceWorker?.controller;
						const parentLocation = current.parent.location?.href?.substring(0, 80) || 'unknown';

						console.log(`[iframes-trap] findCapableAncestor depth=${depth}: hasIframesTrap=${hasIframesTrap}, hasSW=${hasSW}, loc=${parentLocation}`);

						// Prefer ancestors with the iframes-trap message listener
						if (hasIframesTrap && !firstCapable) {
							firstCapable = current.parent;
						}
						// Fall back to any SW-controlled ancestor
						if (hasSW && !fallback) {
							fallback = current.parent;
						}
					}
				} catch (e) {
					// Cross-origin, can't use this parent
					console.log(`[iframes-trap] findCapableAncestor depth=${depth}: cross-origin error: ${e.message}`);
					break;
				}
				current = current.parent;
			}
			const result = firstCapable || fallback;
			console.log(`[iframes-trap] findCapableAncestor result: ${result ? 'found' : 'null'}`);
			return result;
		} catch (e) {
			// Ignore errors traversing frame hierarchy
			console.log(`[iframes-trap] findCapableAncestor error: ${e.message}`);
		}
		return null;
	}

	/**
	 * Schedule iframe control for the next browser task.
	 * This is necessary for nested contexts where synchronous src assignment
	 * doesn't trigger navigation during script execution.
	 *
	 * The solution: delegate iframe creation to an ancestor window that CAN
	 * successfully trigger iframe navigation. The iframe is created in the
	 * parent's DOM but can be accessed by the child.
	 *
	 * Uses message passing to create iframes in ancestor windows to work around
	 * Firefox's cross-realm restrictions.
	 */
	function scheduleIframeControl(iframe) {
		// Mark as pending control
		iframe.setAttribute('data-control-pending', '1');

		// Wait until the iframe is connected to the DOM
		const tryControl = async () => {
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
			const controlledId = `${finalId}-controlled`;

			// Collect attributes to copy
			const attributes = {};
			for (const attr of iframe.attributes) {
				if (attr.name !== 'src' && attr.name !== 'data-control-pending' && attr.name !== 'id') {
					attributes[attr.name] = attr.value;
				}
			}

			// Calculate position for the controlled iframe
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

			const style = {
				position: 'fixed',
				top: `${rect.top + offsetTop}px`,
				left: `${rect.left + offsetLeft}px`,
				width: `${rect.width}px`,
				height: `${rect.height}px`,
				zIndex: '999999',
				border: iframe.style.border || 'none',
			};

			const loaderUrl = getEmptyLoaderUrl();

			try {
				// Use message passing to create the iframe in the ancestor's realm
				// This is critical for Firefox compatibility
				const controlledIframe = await requestAncestorCreateIframe(capableAncestor, {
					id: controlledId,
					src: loaderUrl,
					attributes,
					style,
				});

				// Hide the original iframe (it won't be used for content)
				iframe.style.visibility = 'hidden';

				// Set up position updates
				const updatePosition = () => {
					try {
						if (!iframe.isConnected) {
							controlledIframe.remove();
							return;
						}
						const newRect = iframe.getBoundingClientRect();
						let newOffsetTop = 0;
						let newOffsetLeft = 0;
						let w = window;
						while (w !== capableAncestor && w.frameElement) {
							const frameRect = w.frameElement.getBoundingClientRect();
							newOffsetTop += frameRect.top;
							newOffsetLeft += frameRect.left;
							w = w.parent;
						}
						controlledIframe.style.top = `${newRect.top + newOffsetTop}px`;
						controlledIframe.style.left = `${newRect.left + newOffsetLeft}px`;
						controlledIframe.style.width = `${newRect.width}px`;
						controlledIframe.style.height = `${newRect.height}px`;
						requestAnimationFrame(updatePosition);
					} catch {
						// Stop updating if we can't access the iframe
					}
				};
				requestAnimationFrame(updatePosition);

				// Mark original as controlled (even though actual content is elsewhere)
				iframe.setAttribute('data-controlled', '1');
				iframe.setAttribute('data-controlled-by', controlledId);
				iframe.removeAttribute('data-control-pending');

				// Store reference for contentWindow/contentDocument access
				iframe.__controlledIframe = controlledIframe;
			} catch (error) {
				// Message passing failed, fall back to direct approach (might not work in Firefox)
				console.warn('[iframes-trap] Message-based iframe creation failed, falling back to direct approach:', error);

				const ancestorDoc = capableAncestor.document;
				const ancestorNativeCreate = ancestorDoc.__playground_native_createElement || Native.createElement;
				const controlledIframe = ancestorNativeCreate.call(ancestorDoc, 'iframe');
				controlledIframe.id = controlledId;

				for (const [name, value] of Object.entries(attributes)) {
					controlledIframe.setAttribute(name, value);
				}
				Object.assign(controlledIframe.style, style);

				iframe.style.visibility = 'hidden';
				ancestorDoc.body.appendChild(controlledIframe);
				setIframeSrc(controlledIframe, loaderUrl, capableAncestor);

				const updatePosition = () => {
					try {
						if (!iframe.isConnected) {
							controlledIframe.remove();
							return;
						}
						const newRect = iframe.getBoundingClientRect();
						let newOffsetTop = 0;
						let newOffsetLeft = 0;
						let w = window;
						while (w !== capableAncestor && w.frameElement) {
							const frameRect = w.frameElement.getBoundingClientRect();
							newOffsetTop += frameRect.top;
							newOffsetLeft += frameRect.left;
							w = w.parent;
						}
						controlledIframe.style.top = `${newRect.top + newOffsetTop}px`;
						controlledIframe.style.left = `${newRect.left + newOffsetLeft}px`;
						controlledIframe.style.width = `${newRect.width}px`;
						controlledIframe.style.height = `${newRect.height}px`;
						requestAnimationFrame(updatePosition);
					} catch {
						// Stop updating
					}
				};
				requestAnimationFrame(updatePosition);

				iframe.setAttribute('data-controlled', '1');
				iframe.setAttribute('data-controlled-by', controlledId);
				iframe.removeAttribute('data-control-pending');
				iframe.__controlledIframe = controlledIframe;
			}
		};

		// Defer to next animation frame for better timing
		requestAnimationFrame(tryControl);
	}

	function handleCreateElement(element, args) {
		const tagName = args[0];
		if (String(tagName).toLowerCase() !== 'iframe') {
			return element;
		}

		// Don't do anything special in createElement.
		// The MutationObserver will handle it when the iframe is appended to the DOM.
		// This avoids race conditions where:
		// 1. createElement sets src to loader#base=...
		// 2. srcdoc is set, triggering async rewriteSrcdoc
		// 3. appendChild happens, navigating to the old src (without id)
		// 4. rewriteSrcdoc finishes, tries to update src but navigation already happened
		//
		// This works for both top-level and nested contexts since we now use
		// direct navigation (not overlay iframes) for all cases.
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

	// ============================================================================
	// Patch Document.prototype.open/write/writeln/close to preserve SW control
	// ============================================================================
	//
	// When TinyMCE or similar libraries call document.open(), document.write(),
	// document.close() on a controlled iframe, the native implementations would
	// destroy the document and replace it with a new one that is NOT controlled
	// by the service worker.
	//
	// Our approach: Instead of letting document.open()/write()/close() replace
	// the document, we simulate their behavior using DOM manipulation:
	// - document.open(): Clear the document body and head (but keep the document itself)
	// - document.write(): Parse the HTML and append to the document
	// - document.close(): No-op (document is already usable)
	//
	// This keeps the iframe's document controlled by the service worker while
	// still allowing TinyMCE's initialization pattern to work.
	// ============================================================================

	/**
	 * WeakMap to track iframes that are in "document.write mode".
	 * When document.open() is called on a controlled iframe, we switch to
	 * using our simulated write() instead of the native one.
	 */
	const iframeWriteState = new WeakMap();

	/**
	 * Get the iframe element that owns a document, if any.
	 */
	function getIframeForDocument(doc) {
		try {
			const win = doc.defaultView;
			if (win && win.frameElement instanceof HTMLIFrameElement) {
				return win.frameElement;
			}
		} catch {
			// Cross-origin or other access error
		}
		return null;
	}

	/**
	 * Check if a document belongs to an iframe that is ALREADY SW-controlled.
	 * We only intercept document.write() on iframes that actually have a
	 * service worker controller, because:
	 *
	 * 1. If the iframe has a SW controller, document.write() would destroy
	 *    that control - we want to preserve it by using DOM manipulation instead
	 * 2. If the iframe doesn't have a SW controller yet, we should let the
	 *    native document.write() happen, then capture the content afterward
	 *    and navigate the iframe to a controlled URL
	 *
	 * This approach avoids the race condition where we intercept document.write()
	 * before the iframe has navigated to a controlled URL, which would prevent
	 * it from ever becoming SW-controlled.
	 */
	function shouldInterceptDocumentWrite(doc) {
		const iframe = getIframeForDocument(doc);
		if (!iframe) return false;

		// Only intercept if the iframe ACTUALLY has a SW controller right now
		// This means the iframe has already navigated to a controlled URL
		try {
			const iframeWindow = iframe.contentWindow;
			if (iframeWindow?.navigator?.serviceWorker?.controller) {
				return true;
			}
		} catch {
			// Cross-origin error - can't check, don't intercept
		}

		return false;
	}

	/**
	 * Parse HTML string and extract head and body content.
	 * Returns { headContent, bodyContent, bodyAttributes }.
	 */
	function parseHtmlString(html) {
		// Use DOMParser to parse the HTML
		const parser = new DOMParser();
		const parsed = parser.parseFromString(html, 'text/html');

		return {
			headContent: parsed.head ? parsed.head.innerHTML : '',
			bodyContent: parsed.body ? parsed.body.innerHTML : '',
			bodyAttributes: parsed.body ? Array.from(parsed.body.attributes) : [],
			title: parsed.title || '',
		};
	}

	// Wrap Document.prototype.open
	const NativeDocOpen = Document.prototype.open;
	Document.prototype.open = function (...args) {
		// Check if this is an iframe in a controlled context
		if (shouldInterceptDocumentWrite(this)) {
			const iframe = getIframeForDocument(this);

			// Initialize write state for this iframe
			iframeWriteState.set(iframe, {
				buffer: [],
				isOpen: true,
			});

			// Clear the document content but preserve the document itself
			// This simulates what document.open() does without destroying SW control
			try {
				// Clear head content except for essential elements (base, our script)
				const head = this.head;
				if (head) {
					const toRemove = [];
					for (const child of head.children) {
						// Keep base tag and our iframes-trap script
						if (child.tagName === 'BASE') continue;
						if (child.tagName === 'SCRIPT' && child.src?.includes('iframes-trap')) continue;
						toRemove.push(child);
					}
					toRemove.forEach(el => el.remove());
				}

				// Clear body content
				if (this.body) {
					this.body.innerHTML = '';
					// Remove all body attributes except essential ones
					const attrs = Array.from(this.body.attributes);
					for (const attr of attrs) {
						this.body.removeAttribute(attr.name);
					}
				}
			} catch (e) {
				console.warn('[iframes-trap] Error clearing document in open():', e);
			}

			// Return this document (like native open does)
			return this;
		}

		// Not a controlled iframe, use native behavior
		return NativeDocOpen.apply(this, args);
	};

	// Wrap Document.prototype.write
	const NativeDocWrite = Document.prototype.write;
	Document.prototype.write = function (...args) {
		const iframe = getIframeForDocument(this);
		const state = iframe ? iframeWriteState.get(iframe) : null;

		// If we're in "simulated write mode" for an iframe in controlled context
		if (state?.isOpen && shouldInterceptDocumentWrite(this)) {
			// Buffer the content
			state.buffer.push(...args);
			return;
		}

		// Not a controlled context or not in write mode, use native behavior
		return NativeDocWrite.apply(this, args);
	};

	// Wrap Document.prototype.writeln
	const NativeDocWriteln = Document.prototype.writeln;
	Document.prototype.writeln = function (...args) {
		const iframe = getIframeForDocument(this);
		const state = iframe ? iframeWriteState.get(iframe) : null;

		// If we're in "simulated write mode" for an iframe in controlled context
		if (state?.isOpen && shouldInterceptDocumentWrite(this)) {
			// Buffer the content with newlines
			state.buffer.push(...args.map(a => a + '\n'));
			return;
		}

		// Not a controlled iframe or not in write mode, use native behavior
		return NativeDocWriteln.apply(this, args);
	};

	// Wrap Document.prototype.close
	const NativeDocClose = Document.prototype.close;
	Document.prototype.close = function () {
		console.log('[iframes-trap] Document.prototype.close called');
		const iframe = getIframeForDocument(this);
		console.log('[iframes-trap] getIframeForDocument result:', !!iframe, iframe?.id || 'no-id');
		const state = iframe ? iframeWriteState.get(iframe) : null;

		// If we're in "simulated write mode" for an iframe in controlled context
		if (state?.isOpen && shouldInterceptDocumentWrite(this)) {
			state.isOpen = false;

			// Process the buffered content
			const html = state.buffer.join('');
			state.buffer = [];

			if (html) {
				try {
					const { headContent, bodyContent, bodyAttributes, title } = parseHtmlString(html);

					// Set title if present
					if (title) {
						this.title = title;
					}

					// Append head content (scripts, styles, etc.)
					if (headContent && this.head) {
						// Parse and append head elements
						const tempDiv = this.createElement('div');
						tempDiv.innerHTML = headContent;
						while (tempDiv.firstChild) {
							this.head.appendChild(tempDiv.firstChild);
						}
					}

					// Set body content
					if (this.body) {
						this.body.innerHTML = bodyContent;

						// Apply body attributes
						for (const attr of bodyAttributes) {
							this.body.setAttribute(attr.name, attr.value);
						}
					}
				} catch (e) {
					console.warn('[iframes-trap] Error applying buffered content in close():', e);
				}
			}

			// Clean up state
			iframeWriteState.delete(iframe);

			// Mark the iframe as controlled since we successfully handled
			// document.write without destroying the SW control
			if (iframe.getAttribute('data-controlled') !== '1') {
				iframe.setAttribute('data-controlled', '1');
			}
			return;
		}

		// Clean up state if any
		if (state) {
			iframeWriteState.delete(iframe);
		}

		// Use native close behavior
		const result = NativeDocClose.apply(this, arguments);

		// If this is an iframe in a SW-controlled parent, schedule content capture
		// AFTER a microtask to allow any post-close() JavaScript to run (like TinyMCE
		// setting contentEditable on the body).
		if (iframe) {
			const parentWindow = iframe.ownerDocument?.defaultView;
			const parentHasController = parentWindow?.navigator?.serviceWorker?.controller;

			console.log('[iframes-trap] document.close() called on iframe, parentHasController:', parentHasController);

			if (parentHasController) {
				// Mark that we're handling this iframe
				iframe.setAttribute('data-docwrite-controlled', '1');

				// Use double setTimeout to ensure all synchronous JS runs first
				// (TinyMCE sets contentEditable after close() in the same call stack)
				setTimeout(() => {
					setTimeout(async () => {
						// Only proceed if iframe is still in DOM
						if (!iframe.isConnected) {
							console.log('[iframes-trap] document.close handler: iframe not connected');
							return;
						}

						// Capture the CURRENT state (after TinyMCE's modifications)
						const currentDoc = iframe.contentDocument;
						const finalHtml = currentDoc?.documentElement?.outerHTML;
						if (!finalHtml) {
							console.log('[iframes-trap] document.close handler: no HTML to capture');
							return;
						}

						console.log('[iframes-trap] document.close handler: navigating to SW-controlled URL');
						// Navigate the iframe to a SW-controlled URL
						// The proxy will redirect subsequent access to the new document
						await rewriteSrcdoc(iframe, finalHtml);
						console.log('[iframes-trap] document.close handler: navigation complete');
					}, 0);
				}, 0);
			}
		}

		return result;
	};

	// ============================================================================
	// contentWindow/contentDocument getters - wrap to intercept document.write
	// ============================================================================
	//
	// We can't patch Document.prototype.close in the iframe's realm because
	// the iframe starts as about:blank and we don't control it yet. Instead,
	// we wrap contentDocument to return a proxy that intercepts open/write/close
	// calls on about:blank iframes in SW-controlled contexts.
	// ============================================================================

	/**
	 * WeakMap to track proxied documents and their write state.
	 * Key: original Document, Value: { buffer: string[], isOpen: boolean }
	 */
	const documentWriteProxyState = new WeakMap();

	/**
	 * Create a proxy for a document that intercepts open/write/close calls.
	 *
	 * IMPORTANT: This proxy is "live" - after navigation, property access
	 * automatically goes to the NEW document. This allows TinyMCE to store
	 * a reference to `iframe.contentDocument` before navigation, and have
	 * it automatically work with the new document after navigation.
	 */
	function createDocumentWriteProxy(iframe, doc) {
		// Only proxy if the parent has SW controller
		const parentWindow = iframe.ownerDocument?.defaultView;
		const parentHasController = parentWindow?.navigator?.serviceWorker?.controller;
		if (!parentHasController) {
			return doc;
		}

		// Check if already proxied
		if (doc.__playground_proxied__) {
			return doc;
		}

		const state = { buffer: [], isOpen: false, navigating: false };
		documentWriteProxyState.set(doc, state);

		// Helper to get the current document from the iframe
		// After navigation, this returns the NEW document
		const getCurrentDoc = () => {
			try {
				return Native.contentDocument.get.call(iframe);
			} catch {
				return doc; // Fallback to original if access fails
			}
		};

		const proxy = new Proxy(doc, {
			get(target, prop, receiver) {
				if (prop === '__playground_proxied__') return true;
				if (prop === '__playground_original__') return target;
				if (prop === '__playground_iframe__') return iframe;

				if (prop === 'open') {
					return function (...args) {
						console.log('[iframes-trap] Proxied document.open() called');
						state.isOpen = true;
						state.buffer = [];
						// Don't call native open - we'll handle everything in close()
						return proxy; // Return proxy for chaining
					};
				}

				if (prop === 'write') {
					return function (...args) {
						if (state.isOpen) {
							console.log('[iframes-trap] Proxied document.write() called, buffering');
							state.buffer.push(...args);
							return;
						}
						// If not in write mode, call native on current doc
						const currentDoc = getCurrentDoc();
						return currentDoc.write.apply(currentDoc, args);
					};
				}

				if (prop === 'writeln') {
					return function (...args) {
						if (state.isOpen) {
							console.log('[iframes-trap] Proxied document.writeln() called, buffering');
							state.buffer.push(...args.map(a => a + '\n'));
							return;
						}
						const currentDoc = getCurrentDoc();
						return currentDoc.writeln.apply(currentDoc, args);
					};
				}

				if (prop === 'close') {
					return function () {
						console.log('[iframes-trap] Proxied document.close() called');
						if (!state.isOpen) {
							const currentDoc = getCurrentDoc();
							return currentDoc.close.apply(currentDoc, arguments);
						}

						state.isOpen = false;
						const html = state.buffer.join('');
						state.buffer = [];
						console.log('[iframes-trap] Proxied document.close: buffered HTML length:', html.length);

						// Mark that we're handling this iframe
						iframe.setAttribute('data-docwrite-controlled', '1');

						// Parse the HTML to extract structure WITHOUT triggering resource loads
						// We need to create the DOM structure so TinyMCE's post-close() operations
						// like `doc.body.contentEditable = 'true'` can work immediately.
						const parser = new DOMParser();
						const parsed = parser.parseFromString(html, 'text/html');

						// Apply the structure via DOM manipulation (not document.write)
						// This doesn't trigger CSS/image loading from about:blank
						target.open();
						target.write('<!DOCTYPE html><html><head></head><body></body></html>');
						target.close();

						// Copy body content and attributes
						if (parsed.body && target.body) {
							target.body.innerHTML = parsed.body.innerHTML;
							for (const attr of parsed.body.attributes) {
								target.body.setAttribute(attr.name, attr.value);
							}
						}

						// Copy head content (without link/script tags that would load resources)
						if (parsed.head && target.head) {
							for (const child of parsed.head.children) {
								if (child.tagName !== 'LINK' && child.tagName !== 'SCRIPT') {
									target.head.appendChild(child.cloneNode(true));
								}
							}
						}

						// Set title
						if (parsed.title) {
							target.title = parsed.title;
						}

						// Now schedule navigation to SW-controlled URL after TinyMCE finishes
						// its synchronous post-close() operations. The proxy will redirect
						// all subsequent property access to the new document.
						setTimeout(() => {
							setTimeout(async () => {
								if (!iframe.isConnected) {
									console.log('[iframes-trap] Proxied close: iframe not connected');
									return;
								}

								// Capture the CURRENT state (including TinyMCE's modifications)
								const currentDoc = getCurrentDoc();
								const finalHtml = currentDoc?.documentElement?.outerHTML;
								if (!finalHtml) {
									console.log('[iframes-trap] Proxied close: no HTML to capture');
									return;
								}

								// Merge the original CSS/script resources back in
								// The parser extracted head content which we stripped
								const headContent = parsed.head?.innerHTML || '';
								const mergedHtml = finalHtml.replace('</head>', headContent + '</head>');

								console.log('[iframes-trap] Proxied close: navigating to SW-controlled URL');
								await rewriteSrcdoc(iframe, mergedHtml);
								console.log('[iframes-trap] Proxied close: navigation complete');
							}, 0);
						}, 0);

						return;
					};
				}

				// For all other properties, access them on the CURRENT document
				// This makes the proxy "live" - after navigation, it accesses
				// the new document automatically
				try {
					const currentDoc = getCurrentDoc();
					const value = currentDoc[prop];
					if (typeof value === 'function') {
						return value.bind(currentDoc);
					}
					return value;
				} catch (e) {
					// Some properties might throw, just return undefined
					return undefined;
				}
			},

			set(target, prop, value) {
				// Set on the CURRENT document
				try {
					const currentDoc = getCurrentDoc();
					currentDoc[prop] = value;
					return true;
				} catch (e) {
					return false;
				}
			}
		});

		return proxy;
	}

	/**
	 * WeakMap to cache proxied windows.
	 * Key: iframe element, Value: proxied window
	 */
	const proxiedWindowCache = new WeakMap();

	/**
	 * Create a proxy for a window that wraps the document property.
	 */
	function createWindowProxy(iframe, win) {
		// Check cache first
		const cached = proxiedWindowCache.get(iframe);
		if (cached && cached.win === win) {
			return cached.proxy;
		}

		const proxy = new Proxy(win, {
			get(target, prop, receiver) {
				if (prop === 'document') {
					const doc = target.document;
					if (doc) {
						return createDocumentWriteProxy(iframe, doc);
					}
					return doc;
				}

				// For all other properties, access them directly on the target
				// to preserve proper binding (especially for getters like navigator)
				try {
					const value = target[prop];
					if (typeof value === 'function') {
						return value.bind(target);
					}
					return value;
				} catch (e) {
					// Some properties might throw, just return undefined
					return undefined;
				}
			}
		});

		proxiedWindowCache.set(iframe, { win, proxy });
		return proxy;
	}

	Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
		configurable: true,
		enumerable: Native.contentWindow?.enumerable ?? true,
		get() {
			const win = Native.contentWindow.get.call(this);
			if (!win) return win;

			// Only proxy if the parent has SW controller
			const parentWindow = this.ownerDocument?.defaultView;
			const parentHasController = parentWindow?.navigator?.serviceWorker?.controller;
			if (!parentHasController) {
				return win;
			}

			return createWindowProxy(this, win);
		},
	});

	Object.defineProperty(HTMLIFrameElement.prototype, 'contentDocument', {
		configurable: true,
		enumerable: Native.contentDocument?.enumerable ?? true,
		get() {
			const doc = Native.contentDocument.get.call(this);
			if (!doc) return doc;

			// Wrap the document in a proxy to intercept document.write calls
			return createDocumentWriteProxy(this, doc);
		},
	});

	/**
	 * Check if an iframe's src value indicates it's uncontrolled and needs
	 * to be redirected through the loader. This handles cases where iframes
	 * were created before iframes-trap.js loaded and patched the prototypes.
	 */
	function isUncontrolledSrc(src) {
		if (!src) return true;
		const srcLower = src.toLowerCase();
		return (
			srcLower === '' ||
			srcLower === 'about:blank' ||
			srcLower.startsWith('javascript:')
		);
	}

	/**
	 * Control an iframe that was just added to the DOM.
	 * Uses direct navigation for all contexts (nested or not).
	 *
	 * This function handles iframes that were created before iframes-trap.js
	 * loaded, or iframes with uncontrolled src values (javascript:, about:blank, etc.).
	 *
	 * Since we now serve cached HTML directly from the SW (not via innerHTML
	 * injection), nested iframe navigation works properly. We can simply set
	 * the src attribute and the iframe will navigate.
	 */
	function controlIframeOnMutation(iframe) {
		if (iframe.getAttribute('data-controlled') === '1' || iframe.getAttribute('data-control-pending') === '1') {
			return;
		}

		// Check if srcdoc is being processed - let rewriteSrcdoc handle it
		if (iframe.getAttribute('data-srcdoc-pending') === '1') {
			return;
		}

		// Check if this is a document.write iframe - don't navigate these
		// as it would break TinyMCE's references. They have iframes-trap.js
		// injected directly instead.
		if (iframe.getAttribute('data-docwrite-controlled') === '1') {
			return;
		}

		// Check if iframe has srcdoc - these are handled separately
		if (iframe.hasAttribute('srcdoc')) {
			return;
		}

		// Check if iframe has a "real" src that shouldn't be intercepted
		const currentSrc = iframe.getAttribute('src') || '';
		if (currentSrc && !isUncontrolledSrc(currentSrc)) {
			// Has a real URL src, don't intercept
			return;
		}

		// Iframe either has no src, or has an uncontrolled src (javascript:, about:blank, etc.)
		// Navigate the original iframe to make it SW-controlled.
		//
		// We need to cache empty content and navigate to it, just like we do for srcdoc.
		// This ensures the iframe loads a "real" document from the SW.
		controlEmptyIframe(iframe);
	}

	/**
	 * Control an empty iframe by caching minimal HTML and navigating to it.
	 * This uses the same approach as rewriteSrcdoc to ensure nested iframes work.
	 */
	async function controlEmptyIframe(iframe) {
		iframe.setAttribute('data-control-pending', '1');

		const id = uid();
		const base = document.baseURI;

		// Cache minimal HTML with iframes-trap.js injected
		const minimalHtml = '<!DOCTYPE html><html><head></head><body></body></html>';
		await cacheIframeContents(id, minimalHtml, base, '');

		const scope = await scopePromise;
		const { VIRTUAL_PREFIX } = scopedPaths(scope);
		const url = `${VIRTUAL_PREFIX}${id}.html`;

		// Remove and re-add to force navigation
		const parent = iframe.parentNode;
		const nextSibling = iframe.nextSibling;

		if (parent) {
			parent.removeChild(iframe);
		}

		setIframeSrc(iframe, url);

		if (parent) {
			if (nextSibling) {
				parent.insertBefore(iframe, nextSibling);
			} else {
				parent.appendChild(iframe);
			}
		}

		iframe.removeAttribute('data-control-pending');
		iframe.setAttribute('data-controlled', '1');
		console.log('[iframes-trap] controlEmptyIframe: navigated to cached URL:', url);
	}

	/**
	 * Request an ancestor window to create a SW-controlled iframe.
	 *
	 * IMPORTANT: Due to browser limitations, iframes created in nested documents
	 * (inside other iframes) cannot be navigated - setting their src does NOT
	 * trigger navigation. The only way to get SW control is to create the iframe
	 * in an ancestor document (typically the top-level document) where navigation
	 * works properly.
	 *
	 * This function:
	 * 1. Hides the original iframe (keeps it in DOM for JavaScript references)
	 * 2. Asks an ancestor to create a controlled iframe in its document
	 * 3. Positions the controlled iframe to visually overlay the original
	 * 4. Stores a reference on the original iframe to the controlled one
	 *
	 * This approach preserves the original iframe's DOM presence (for querySelector,
	 * etc.) while providing SW control through the replacement.
	 */
	function requestAncestorNavigateIframe(ancestorWindow, iframe, url) {
		// Generate a unique ID for cross-document reference
		const iframeId = iframe.id || `pg-nav-${uid()}`;
		if (!iframe.id) {
			iframe.id = iframeId;
		}

		console.log('[iframes-trap] Requesting ancestor to create controlled iframe for:', iframeId);

		// Hide the original iframe - it can't be navigated from a nested context
		iframe.style.visibility = 'hidden';
		iframe.setAttribute('data-controlled-by', iframeId + '-controlled');

		// Use message passing with a response channel
		const channel = new MessageChannel();
		channel.port1.onmessage = (event) => {
			if (event.data.success) {
				console.log('[iframes-trap] Ancestor created controlled iframe:', event.data.iframeId);
				// Store reference to the controlled iframe for JavaScript code
				// that might access the original iframe
				try {
					const ancestorIframes = ancestorWindow.__pg_iframes || {};
					const controlledIframe = ancestorIframes[event.data.iframeId];
					if (controlledIframe) {
						iframe.__controlledIframe = controlledIframe;
					}
				} catch (e) {
					console.log('[iframes-trap] Could not store reference:', e.message);
				}
			} else {
				console.error('[iframes-trap] Failed to create controlled iframe:', event.data.error);
			}
		};

		// Get the iframe's position relative to the top document
		// This is used to position the controlled iframe correctly
		const getPosition = () => {
			try {
				const rect = iframe.getBoundingClientRect();
				const ownerWindow = iframe.ownerDocument?.defaultView;
				// Accumulate offset through iframe hierarchy
				let offsetX = rect.left;
				let offsetY = rect.top;
				let win = ownerWindow;
				while (win && win !== ancestorWindow && win.frameElement) {
					const parentRect = win.frameElement.getBoundingClientRect();
					offsetX += parentRect.left;
					offsetY += parentRect.top;
					win = win.parent;
				}
				return { x: offsetX, y: offsetY, width: rect.width, height: rect.height };
			} catch (e) {
				return { x: 0, y: 0, width: 300, height: 150 };
			}
		};

		const pos = getPosition();

		// Send request to ancestor
		ancestorWindow.postMessage({
			type: '__playground_create_iframe',
			config: {
				id: iframeId + '-controlled',
				src: url,
				attributes: {
					'data-controlled': '1',
					'data-for': iframeId,
				},
				style: {
					position: 'absolute',
					left: pos.x + 'px',
					top: pos.y + 'px',
					width: pos.width + 'px',
					height: pos.height + 'px',
					border: 'none',
					zIndex: '999999',
				},
			},
		}, '*', [channel.port2]);

		iframe.setAttribute('data-controlled', '1');
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
	// Handle existing iframes - scan for iframes that were created before
	// iframes-trap.js loaded and need to be controlled
	// ============================================================================
	document.querySelectorAll('iframe').forEach((iframe) => {
		controlIframeOnMutation(iframe);
	});

	// ============================================================================
	// Anti-flash CSS - hide iframes until they're controlled
	// ============================================================================
	const style = document.createElement('style');
	style.textContent = `iframe{visibility:hidden} iframe[data-controlled="1"]{visibility:visible}`;
	document.documentElement.appendChild(style);
}

setupIframesTrap();
