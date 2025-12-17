/**
 * iframes-trap.js
 *
 * This script ensures resources loaded from uncontrolled iframes (about:blank, srcdoc,
 * data:, blob:) can still be fetched through the service worker.
 *
 * The problem: Iframes with these URLs are NOT controlled by the parent's service worker,
 * which means fetch/XHR requests and resource loading bypass the SW entirely. This causes
 * CSS files, images, and other assets to fail with 404 errors in WordPress Playground.
 *
 * The solution:
 * 1. For iframes using src/srcdoc with static content, redirect to a SW-controlled loader
 * 2. For iframes populated via document.write() (like TinyMCE), inject a resource proxy
 *    script that routes fetch/XHR through the parent window (which IS SW-controlled)
 *
 * This approach preserves TinyMCE's ability to interact with its iframe document while
 * still allowing resources to load through the service worker.
 *
 * Related browser bugs:
 * - Chrome: https://bugs.chromium.org/p/chromium/issues/detail?id=880768
 * - Firefox: https://bugzilla.mozilla.org/show_bug.cgi?id=1293277
 * - Spec: https://github.com/w3c/ServiceWorker/issues/765
 */
(function() {
    'use strict';

    // Prevent multiple injections
    if (window.__playgroundIframesTrapInstalled) {
        return;
    }
    window.__playgroundIframesTrapInstalled = true;

    // Get scope prefix for URLs
    function getScopePrefix() {
        const currentPath = window.location.pathname;
        const scopeMatch = currentPath.match(/^(\/scope:[^/]+\/)/);
        return scopeMatch ? scopeMatch[1] : '/';
    }
    const scopePrefix = getScopePrefix();

    // Counter for generating unique request IDs
    let requestIdCounter = 0;

    // Pending resource requests from child iframes
    const pendingRequests = new Map();

    /**
     * The resource proxy script that gets injected into iframes.
     * This script intercepts fetch/XHR and routes them through the parent window.
     */
    const resourceProxyScript = `
(function() {
    if (window.__playgroundResourceProxyInstalled) return;
    window.__playgroundResourceProxyInstalled = true;

    const pendingRequests = new Map();
    let requestId = 0;

    // Listen for responses from parent
    window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'playground-resource-response') {
            const pending = pendingRequests.get(event.data.requestId);
            if (pending) {
                pendingRequests.delete(event.data.requestId);
                if (event.data.error) {
                    pending.reject(new Error(event.data.error));
                } else {
                    pending.resolve(event.data);
                }
            }
        }
    });

    // Request a resource through the parent window
    function requestResource(url, options) {
        return new Promise(function(resolve, reject) {
            const id = ++requestId;
            pendingRequests.set(id, { resolve: resolve, reject: reject });

            // Resolve relative URLs against current location
            let absoluteUrl;
            try {
                absoluteUrl = new URL(url, window.location.href).href;
            } catch (e) {
                absoluteUrl = url;
            }

            window.parent.postMessage({
                type: 'playground-resource-request',
                requestId: id,
                url: absoluteUrl,
                options: options || {}
            }, '*');

            // Timeout after 30 seconds
            setTimeout(function() {
                if (pendingRequests.has(id)) {
                    pendingRequests.delete(id);
                    reject(new Error('Resource request timeout: ' + url));
                }
            }, 30000);
        });
    }

    // Override fetch
    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
        const url = typeof input === 'string' ? input : input.url;

        // Only proxy http/https URLs or relative URLs
        if (url && (url.startsWith('http') || url.startsWith('/') || !url.includes(':'))) {
            return requestResource(url, {
                method: init?.method || 'GET',
                headers: init?.headers || {},
                body: init?.body
            }).then(function(response) {
                return new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                });
            });
        }

        return originalFetch.apply(this, arguments);
    };

    // Override XMLHttpRequest
    const OriginalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
        const xhr = new OriginalXHR();
        const originalOpen = xhr.open.bind(xhr);
        const originalSend = xhr.send.bind(xhr);

        let method = 'GET';
        let url = '';
        let async = true;

        xhr.open = function(m, u, a) {
            method = m;
            url = u;
            async = a !== false;
            return originalOpen.apply(this, arguments);
        };

        xhr.send = function(body) {
            // Only proxy http/https URLs or relative URLs
            if (url && (url.startsWith('http') || url.startsWith('/') || !url.includes(':'))) {
                const self = this;

                requestResource(url, { method: method, body: body })
                    .then(function(response) {
                        Object.defineProperty(self, 'status', { value: response.status, writable: false });
                        Object.defineProperty(self, 'statusText', { value: response.statusText, writable: false });
                        Object.defineProperty(self, 'responseText', { value: response.body, writable: false });
                        Object.defineProperty(self, 'response', { value: response.body, writable: false });
                        Object.defineProperty(self, 'readyState', { value: 4, writable: false });

                        if (self.onreadystatechange) self.onreadystatechange();
                        if (self.onload) self.onload();
                    })
                    .catch(function(error) {
                        Object.defineProperty(self, 'status', { value: 0, writable: false });
                        Object.defineProperty(self, 'readyState', { value: 4, writable: false });

                        if (self.onreadystatechange) self.onreadystatechange();
                        if (self.onerror) self.onerror(error);
                    });

                return;
            }

            return originalSend.apply(this, arguments);
        };

        return xhr;
    };

    // Handle CSS loading by observing link elements
    const observer = new MutationObserver(function(mutations) {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;

                // Handle <link rel="stylesheet">
                if (node.tagName === 'LINK' && node.rel === 'stylesheet' && node.href) {
                    loadStylesheet(node);
                }

                // Handle <img> elements
                if (node.tagName === 'IMG' && node.src) {
                    loadImage(node);
                }

                // Check children
                if (node.querySelectorAll) {
                    node.querySelectorAll('link[rel="stylesheet"]').forEach(loadStylesheet);
                    node.querySelectorAll('img[src]').forEach(loadImage);
                }
            }
        }
    });

    function loadStylesheet(link) {
        if (link.dataset.proxyLoading) return;
        link.dataset.proxyLoading = 'true';

        const href = link.href;
        requestResource(href, { method: 'GET' })
            .then(function(response) {
                if (response.status === 200) {
                    const style = document.createElement('style');
                    style.textContent = response.body;
                    link.parentNode.insertBefore(style, link);
                    link.remove();
                }
            })
            .catch(function(err) {
                console.warn('[resource-proxy] Failed to load stylesheet:', href, err);
            });
    }

    function loadImage(img) {
        if (img.dataset.proxyLoading) return;
        img.dataset.proxyLoading = 'true';

        const src = img.src;
        // Skip data URLs and blob URLs
        if (src.startsWith('data:') || src.startsWith('blob:')) return;

        requestResource(src, { method: 'GET', responseType: 'base64' })
            .then(function(response) {
                if (response.status === 200 && response.base64) {
                    img.src = 'data:' + (response.contentType || 'image/png') + ';base64,' + response.base64;
                }
            })
            .catch(function(err) {
                console.warn('[resource-proxy] Failed to load image:', src, err);
            });
    }

    // Start observing
    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    } else {
        document.addEventListener('DOMContentLoaded', function() {
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    console.log('[resource-proxy] Installed in iframe');
})();
`;

    /**
     * Listen for resource requests from child iframes and fulfill them
     * through our SW-controlled context
     */
    window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'playground-resource-request') {
            const { requestId, url, options } = event.data;

            // Resolve the URL relative to our scope
            let resolvedUrl;
            try {
                resolvedUrl = new URL(url, window.location.href).href;
            } catch (e) {
                resolvedUrl = url;
            }

            // Fetch the resource through our SW-controlled context
            const fetchOptions = {
                method: options.method || 'GET',
                headers: options.headers || {},
            };
            if (options.body && fetchOptions.method !== 'GET') {
                fetchOptions.body = options.body;
            }

            fetch(resolvedUrl, fetchOptions)
                .then(async function(response) {
                    let body;
                    let base64;
                    const contentType = response.headers.get('content-type') || '';

                    // For images, return as base64
                    if (options.responseType === 'base64' || contentType.startsWith('image/')) {
                        const arrayBuffer = await response.arrayBuffer();
                        const bytes = new Uint8Array(arrayBuffer);
                        let binary = '';
                        for (let i = 0; i < bytes.length; i++) {
                            binary += String.fromCharCode(bytes[i]);
                        }
                        base64 = btoa(binary);
                    } else {
                        body = await response.text();
                    }

                    // Send response back to iframe
                    if (event.source) {
                        event.source.postMessage({
                            type: 'playground-resource-response',
                            requestId: requestId,
                            status: response.status,
                            statusText: response.statusText,
                            headers: Object.fromEntries(response.headers.entries()),
                            body: body,
                            base64: base64,
                            contentType: contentType
                        }, '*');
                    }
                })
                .catch(function(error) {
                    if (event.source) {
                        event.source.postMessage({
                            type: 'playground-resource-response',
                            requestId: requestId,
                            error: error.message
                        }, '*');
                    }
                });
        }
    });

    // Store original descriptors
    const originalSrcDescriptor = Object.getOwnPropertyDescriptor(
        HTMLIFrameElement.prototype, 'src'
    );
    const originalSrcdocDescriptor = Object.getOwnPropertyDescriptor(
        HTMLIFrameElement.prototype, 'srcdoc'
    );
    const originalContentDocumentDescriptor = Object.getOwnPropertyDescriptor(
        HTMLIFrameElement.prototype, 'contentDocument'
    );
    const originalContentWindowDescriptor = Object.getOwnPropertyDescriptor(
        HTMLIFrameElement.prototype, 'contentWindow'
    );

    // Track iframes we've processed
    const processedIframes = new WeakSet();

    /**
     * Inject the resource proxy script into an iframe's document
     */
    function injectResourceProxy(iframe) {
        if (processedIframes.has(iframe)) return;

        try {
            const doc = originalContentDocumentDescriptor.get.call(iframe);
            if (!doc) return;

            // Check if script already injected
            if (doc.__playgroundResourceProxyInstalled) return;

            processedIframes.add(iframe);

            // Inject the script
            const script = doc.createElement('script');
            script.textContent = resourceProxyScript;
            if (doc.head) {
                doc.head.appendChild(script);
            } else if (doc.body) {
                doc.body.insertBefore(script, doc.body.firstChild);
            } else if (doc.documentElement) {
                doc.documentElement.appendChild(script);
            }

            console.log('[iframes-trap] Injected resource proxy into iframe');
        } catch (e) {
            // Cross-origin iframes will throw, which is fine
        }
    }

    /**
     * Track iframes that are being written to via contentDocument.write()
     */
    const iframesBeingWritten = new WeakMap();

    function getWriteTracker(iframe) {
        if (!iframesBeingWritten.has(iframe)) {
            iframesBeingWritten.set(iframe, {
                content: '',
                isOpen: false
            });
        }
        return iframesBeingWritten.get(iframe);
    }

    /**
     * Create a proxy for the document that injects our resource proxy script
     * into content written via document.write()
     */
    function createDocumentProxy(iframe, originalDoc) {
        if (originalDoc.__playgroundProxied) return originalDoc;
        originalDoc.__playgroundProxied = true;

        const tracker = getWriteTracker(iframe);

        const originalOpen = originalDoc.open.bind(originalDoc);
        const originalWrite = originalDoc.write.bind(originalDoc);
        const originalWriteln = originalDoc.writeln.bind(originalDoc);
        const originalClose = originalDoc.close.bind(originalDoc);

        originalDoc.open = function() {
            tracker.content = '';
            tracker.isOpen = true;
            return originalOpen.apply(this, arguments);
        };

        originalDoc.write = function(content) {
            if (tracker.isOpen && content) {
                tracker.content += content;
            }
            return originalWrite.apply(this, arguments);
        };

        originalDoc.writeln = function(content) {
            if (tracker.isOpen && content) {
                tracker.content += content + '\n';
            }
            return originalWriteln.apply(this, arguments);
        };

        originalDoc.close = function() {
            const result = originalClose.apply(this, arguments);

            // After close, inject our resource proxy script
            if (tracker.isOpen) {
                tracker.isOpen = false;

                // Inject resource proxy script after a microtask to let the DOM settle
                Promise.resolve().then(function() {
                    try {
                        const script = originalDoc.createElement('script');
                        script.textContent = resourceProxyScript;
                        if (originalDoc.head) {
                            originalDoc.head.appendChild(script);
                        } else if (originalDoc.body) {
                            originalDoc.body.appendChild(script);
                        }
                        console.log('[iframes-trap] Injected resource proxy after document.write');
                    } catch (e) {
                        console.warn('[iframes-trap] Failed to inject resource proxy:', e);
                    }
                });
            }

            return result;
        };

        return originalDoc;
    }

    // Track which iframes have been proxied
    const proxiedIframes = new WeakSet();

    /**
     * Check if an iframe should have its document proxied
     */
    function shouldProxyIframe(iframe) {
        if (proxiedIframes.has(iframe)) return false;

        const src = originalSrcDescriptor.get.call(iframe);

        // Proxy if no src (about:blank) or explicitly about:blank
        if (!src || src === '' || src === 'about:blank') {
            return true;
        }

        return false;
    }

    /**
     * Override contentDocument to intercept document.write() calls
     */
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentDocument', {
        get: function() {
            const doc = originalContentDocumentDescriptor.get.call(this);

            if (doc && shouldProxyIframe(this)) {
                proxiedIframes.add(this);
                return createDocumentProxy(this, doc);
            }

            return doc;
        },
        configurable: true,
        enumerable: true
    });

    /**
     * Override contentWindow to also intercept document access
     */
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
        get: function() {
            const win = originalContentWindowDescriptor.get.call(this);

            if (win && win.document && shouldProxyIframe(this)) {
                proxiedIframes.add(this);
                createDocumentProxy(this, win.document);
            }

            return win;
        },
        configurable: true,
        enumerable: true
    });

    console.log('[iframes-trap] Installed successfully (resource proxy mode)');
})();
