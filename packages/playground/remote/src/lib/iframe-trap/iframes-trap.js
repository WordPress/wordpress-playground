/**
 * iframes-trap.js
 *
 * This script intercepts iframe creation and modification to ensure all iframes
 * are controlled by the service worker. Iframes created with about:blank, srcdoc,
 * data:, or blob: URLs are NOT controlled by the parent page's service worker,
 * which means network requests from these iframes bypass the service worker entirely.
 *
 * This causes issues in WordPress Playground where:
 * - CSS files fail to load in the site editor
 * - TinyMCE can't load media images
 * - Other assets requested from uncontrolled iframes fail
 *
 * The solution:
 * 1. Override DOM methods used to create/modify iframes
 * 2. When src/srcdoc is set on an iframe, intercept it
 * 3. Store the initial HTML in a shared storage (window.__iframeContents)
 * 4. Set the iframe's src to a controlled URL (/wp-includes/playground-iframe-loader.html)
 * 5. The loader requests content from parent via postMessage and renders it
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

    // Storage for iframe initial content, keyed by unique ID
    if (!window.__iframeContents) {
        window.__iframeContents = new Map();
    }

    // Map from iframe element to its content ID
    if (!window.__iframeIdMap) {
        window.__iframeIdMap = new WeakMap();
    }

    // Counter for generating unique iframe IDs
    let iframeIdCounter = 0;

    // The base URL for the iframe loader (controlled by the service worker)
    const IFRAME_LOADER_URL = '/wp-includes/playground-iframe-loader.html';

    /**
     * Listen for content requests from iframe loaders
     */
    window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'playground-iframe-content-request') {
            const id = event.data.id;
            const contentData = window.__iframeContents.get(id);

            if (contentData && event.source) {
                event.source.postMessage({
                    type: 'playground-iframe-content-response',
                    id: id,
                    content: contentData.content,
                    originalUrl: contentData.originalUrl
                }, '*');

                // Clean up after delivering content
                window.__iframeContents.delete(id);
            }
        }
    });

    /**
     * Determines if a URL needs to be trapped (redirected through our loader)
     */
    function shouldTrapUrl(url) {
        if (!url) return false;

        // Trap about:blank
        if (url === 'about:blank') return true;

        // Trap blob: URLs
        if (url.startsWith('blob:')) return true;

        // Trap data: URLs
        if (url.startsWith('data:')) return true;

        // Trap javascript: URLs
        if (url.startsWith('javascript:')) return true;

        return false;
    }

    /**
     * Read a blob URL synchronously and return its text content
     */
    function readBlobSync(blobUrl) {
        try {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', blobUrl, false); // synchronous
            xhr.overrideMimeType('text/plain;charset=utf-8');
            xhr.send();
            return xhr.responseText;
        } catch (e) {
            console.warn('[iframes-trap] Failed to read blob URL:', e);
            return '';
        } finally {
            // Revoke the blob URL to free memory
            try {
                URL.revokeObjectURL(blobUrl);
            } catch (e) {
                // Ignore errors
            }
        }
    }

    /**
     * Generate a unique ID for storing iframe content
     */
    function generateIframeId() {
        return `iframe-${Date.now()}-${++iframeIdCounter}`;
    }

    /**
     * Store content and return the loader URL
     */
    function storeContentAndGetLoaderUrl(content, originalUrl) {
        const id = generateIframeId();
        window.__iframeContents.set(id, {
            content: content,
            originalUrl: originalUrl,
            timestamp: Date.now()
        });

        // Clean up old entries (older than 1 minute)
        const now = Date.now();
        for (const [key, value] of window.__iframeContents.entries()) {
            if (now - value.timestamp > 60000) {
                window.__iframeContents.delete(key);
            }
        }

        return `${IFRAME_LOADER_URL}?id=${id}`;
    }

    /**
     * Process a src value and return either the original or a trapped URL
     */
    function processSrc(src) {
        if (!shouldTrapUrl(src)) {
            return { trapped: false, url: src };
        }

        let content = '';

        if (src === 'about:blank') {
            content = '<!doctype html><html><head></head><body></body></html>';
        } else if (src.startsWith('blob:')) {
            content = readBlobSync(src);
        } else if (src.startsWith('data:')) {
            // Parse data URL
            try {
                const match = src.match(/^data:([^;,]*)(;base64)?,(.*)$/);
                if (match) {
                    const isBase64 = !!match[2];
                    const data = match[3];
                    content = isBase64 ? atob(data) : decodeURIComponent(data);
                }
            } catch (e) {
                console.warn('[iframes-trap] Failed to parse data URL:', e);
            }
        } else if (src.startsWith('javascript:')) {
            // For javascript: URLs, create an empty document
            content = '<!doctype html><html><head></head><body></body></html>';
        }

        const loaderUrl = storeContentAndGetLoaderUrl(content, src);
        return { trapped: true, url: loaderUrl };
    }

    /**
     * Process a srcdoc value and return a trapped URL
     */
    function processSrcdoc(srcdoc) {
        if (!srcdoc) {
            return { trapped: false, url: null };
        }

        const loaderUrl = storeContentAndGetLoaderUrl(srcdoc, 'srcdoc');
        return { trapped: true, url: loaderUrl };
    }

    // Store original descriptors
    const originalSrcDescriptor = Object.getOwnPropertyDescriptor(
        HTMLIFrameElement.prototype, 'src'
    );
    const originalSrcdocDescriptor = Object.getOwnPropertyDescriptor(
        HTMLIFrameElement.prototype, 'srcdoc'
    );

    // Track which iframes we've trapped to avoid infinite loops
    const trappedIframes = new WeakSet();

    /**
     * Override the src property
     */
    Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
        get: function() {
            return originalSrcDescriptor.get.call(this);
        },
        set: function(value) {
            // If we're in the middle of trapping, use the original setter
            if (trappedIframes.has(this)) {
                trappedIframes.delete(this);
                return originalSrcDescriptor.set.call(this, value);
            }

            const result = processSrc(value);
            if (result.trapped) {
                // Mark as trapped and set the loader URL
                trappedIframes.add(this);
                // Also clear any srcdoc that might interfere
                if (this.hasAttribute('srcdoc')) {
                    this.removeAttribute('srcdoc');
                }
            }
            return originalSrcDescriptor.set.call(this, result.url);
        },
        configurable: true,
        enumerable: true
    });

    /**
     * Override the srcdoc property
     */
    Object.defineProperty(HTMLIFrameElement.prototype, 'srcdoc', {
        get: function() {
            return originalSrcdocDescriptor.get.call(this);
        },
        set: function(value) {
            const result = processSrcdoc(value);
            if (result.trapped) {
                // When srcdoc is set, we need to use src instead
                trappedIframes.add(this);
                return originalSrcDescriptor.set.call(this, result.url);
            }
            return originalSrcdocDescriptor.set.call(this, value);
        },
        configurable: true,
        enumerable: true
    });

    /**
     * Override setAttribute to catch src and srcdoc attribute changes
     */
    const originalSetAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, value) {
        if (this.tagName === 'IFRAME') {
            const lowerName = name.toLowerCase();
            if (lowerName === 'src') {
                this.src = value;
                return;
            }
            if (lowerName === 'srcdoc') {
                this.srcdoc = value;
                return;
            }
        }
        return originalSetAttribute.call(this, name, value);
    };

    /**
     * Override document.createElement to intercept iframe creation with attributes
     * This handles cases like: createElement('iframe', { src: 'about:blank' })
     */
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = function(tagName, options) {
        const element = originalCreateElement(tagName, options);
        // The interception happens when src/srcdoc are set, so no extra work needed here
        return element;
    };

    /**
     * Observe DOM for dynamically inserted iframes with src/srcdoc attributes
     * This catches iframes inserted via innerHTML or similar methods
     */
    const observer = new MutationObserver(function(mutations) {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;

                // Check if the added node is an iframe
                if (node.tagName === 'IFRAME') {
                    processIframe(node);
                }

                // Check for iframes within the added node
                if (node.querySelectorAll) {
                    const iframes = node.querySelectorAll('iframe');
                    for (const iframe of iframes) {
                        processIframe(iframe);
                    }
                }
            }
        }
    });

    function processIframe(iframe) {
        // If the iframe already has a srcdoc attribute, trap it
        const srcdoc = iframe.getAttribute('srcdoc');
        if (srcdoc) {
            iframe.srcdoc = srcdoc;
            return;
        }

        // If the iframe has a src that should be trapped
        const src = iframe.getAttribute('src');
        if (src && shouldTrapUrl(src)) {
            iframe.src = src;
        }
    }

    // Start observing the document
    observer.observe(document.documentElement || document.body || document, {
        childList: true,
        subtree: true
    });

    console.log('[iframes-trap] Installed successfully');
})();
