/**
 * Test Service Worker for iframe control experiments
 *
 * This service worker:
 * 1. Intercepts all fetch requests
 * 2. Serves the iframe loader HTML for trapped iframes
 * 3. Injects the iframes-trap.js script into HTML responses
 * 4. Logs all requests for debugging
 */

const CACHE_NAME = 'iframe-sw-test-v1';

// The iframes-trap script (will be loaded dynamically)
let iframesTrapScript = null;
let iframesTrapScriptPromise = null;

// Function to load the iframes-trap script
function loadIframesTrapScript() {
    if (iframesTrapScript) {
        return Promise.resolve(iframesTrapScript);
    }
    if (!iframesTrapScriptPromise) {
        console.log('[SW] Loading iframes-trap.js...');
        iframesTrapScriptPromise = fetch('./iframes-trap.js')
            .then(r => r.text())
            .then(script => {
                iframesTrapScript = script;
                console.log('[SW] Loaded iframes-trap.js, length:', script.length);
                return script;
            })
            .catch(err => {
                console.error('[SW] Failed to load iframes-trap.js:', err);
                iframesTrapScriptPromise = null;
                return null;
            });
    }
    return iframesTrapScriptPromise;
}

// Load the script immediately
loadIframesTrapScript();

self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    event.waitUntil(
        loadIframesTrapScript().then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(
        loadIframesTrapScript().then(() => self.clients.claim())
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Log all requests
    console.log('[SW] Fetch:', url.pathname);

    // Handle the iframe loader
    if (url.pathname.endsWith('/playground-iframe-loader.html')) {
        event.respondWith(serveIframeLoader(url));
        return;
    }

    // Handle test resource
    if (url.pathname.endsWith('/test-resource.txt')) {
        event.respondWith(new Response('SUCCESS! Fetched via Service Worker', {
            headers: { 'Content-Type': 'text/plain' }
        }));
        return;
    }

    // For HTML files from our origin, inject the iframes-trap script
    if (url.origin === self.location.origin &&
        (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/'))) {

        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Only process successful HTML responses
                    const contentType = response.headers.get('content-type') || '';
                    if (response.ok && contentType.includes('text/html')) {
                        return injectIframesTrapScript(response);
                    }
                    return response;
                })
                .catch(err => {
                    console.error('[SW] Fetch error:', err);
                    return new Response('Error: ' + err.message, { status: 500 });
                })
        );
        return;
    }

    // Pass through all other requests
    event.respondWith(fetch(event.request));
});

/**
 * Serves the iframe loader HTML
 */
function serveIframeLoader(url) {
    const loaderScript = `
(function() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    console.log('[iframe-loader] Loading content for id:', id);

    if (!id) {
        console.error('[iframe-loader] No content ID provided');
        return;
    }

    // Request content from parent
    function requestContent() {
        if (window.parent && window.parent !== window) {
            console.log('[iframe-loader] Requesting content from parent...');
            window.parent.postMessage({
                type: 'playground-iframe-content-request',
                id: id
            }, '*');
        }
    }

    // Listen for content response
    window.addEventListener('message', function handler(event) {
        if (event.data && event.data.type === 'playground-iframe-content-response' && event.data.id === id) {
            window.removeEventListener('message', handler);

            console.log('[iframe-loader] Received content, length:', event.data.content?.length);
            let content = event.data.content || '';

            // Inject the iframes-trap script INTO the content BEFORE writing it
            // This ensures the trap runs before any inline scripts in the content
            const trapScript = '<script data-injected-by="iframe-loader">' + ${JSON.stringify(iframesTrapScript || '// iframes-trap not loaded')} + '<\\/script>';

            // Try to inject right after <head> for earliest execution
            if (content.includes('<head>')) {
                content = content.replace('<head>', '<head>' + trapScript);
            } else if (content.match(/<head\\s/)) {
                content = content.replace(/<head[^>]*>/, '\$&' + trapScript);
            } else if (content.includes('<html>')) {
                content = content.replace('<html>', '<html>' + trapScript);
            } else if (content.match(/<html\\s/)) {
                content = content.replace(/<html[^>]*>/, '\$&' + trapScript);
            } else if (content.toLowerCase().startsWith('<!doctype')) {
                content = content.replace(/(<!doctype[^>]*>)/i, '\$1' + trapScript);
            } else {
                content = trapScript + content;
            }

            // Write the content to the document (trap script will run first)
            document.open();
            document.write(content);
            document.close();

            console.log('[iframe-loader] Content written with iframes-trap pre-injected');
        }
    });

    // Request content with retries
    requestContent();
    setTimeout(requestContent, 50);
    setTimeout(requestContent, 200);
    setTimeout(requestContent, 500);
})();
`;

    return new Response(
        `<!doctype html>
<html>
<head><title>Iframe Loader</title></head>
<body>
<script>${loaderScript}</script>
</body>
</html>`,
        {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
        }
    );
}

/**
 * Injects the iframes-trap.js script into an HTML response
 */
async function injectIframesTrapScript(response) {
    // Wait for the script to be loaded
    await loadIframesTrapScript();

    if (!iframesTrapScript) {
        console.warn('[SW] iframes-trap script not loaded, skipping injection');
        return response;
    }

    const html = await response.text();

    // Create the script tag to inject
    const scriptTag = `<script data-playground-iframes-trap>${iframesTrapScript}</script>`;

    let modifiedHtml;

    // Try to inject right after <head> for earliest execution
    if (html.includes('<head>')) {
        modifiedHtml = html.replace('<head>', '<head>' + scriptTag);
    } else if (html.includes('<head ')) {
        modifiedHtml = html.replace(/<head[^>]*>/, '$&' + scriptTag);
    } else if (html.includes('<html>')) {
        modifiedHtml = html.replace('<html>', '<html>' + scriptTag);
    } else if (html.includes('<html ')) {
        modifiedHtml = html.replace(/<html[^>]*>/, '$&' + scriptTag);
    } else if (html.toLowerCase().startsWith('<!doctype')) {
        modifiedHtml = html.replace(/(<!doctype[^>]*>)/i, '$1' + scriptTag);
    } else {
        modifiedHtml = scriptTag + html;
    }

    console.log('[SW] Injected iframes-trap script into HTML');

    return new Response(modifiedHtml, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
    });
}
