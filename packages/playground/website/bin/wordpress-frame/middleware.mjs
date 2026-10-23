import { readFile } from 'node:fs/promises';

/**
 * Route the local app and WordPress hosts before either server serves static files.
 *
 * For example, playground.localhost:9500 serves the SPA, remote.html, PHP bundles,
 * and WordPress downloads. wp.playground.localhost:9500 serves only the hidden
 * HTTP-request helper, a service-worker loader, and marked thumbnail-worker
 * loaders. Other WordPress-host requests return 404 from this server: a running
 * site's /scope:site-a/ pages come from the browser's WordPress service worker.
 *
 * Reject /scope:... on the app host too. Otherwise user HTML could load on the
 * same origin as the SPA and read its OPFS. Reject unknown hosts rather than
 * letting the static-file middleware expose the app under another hostname.
 * This middleware must therefore run before every express.static() handler.
 *
 * On the first visit there is no WordPress service worker yet. Serve the built
 * wordpress-bridge.html on the WordPress host, but rewrite its script and preload
 * URLs to the app origin. Its modules then identify the correct app parent, and
 * all sites reuse the same public bundles. CORS and CORP headers on app assets
 * let the WordPress document fetch those shared files across origins.
 *
 * Both the normal preview and the release-switching test server use these rules.
 * Resolve getBridgePath() on each helper request so switching releases also
 * switches the helper HTML; capturing its initial path would mix build versions.
 * This is host/path routing, not authorization between WordPress sites. It does
 * not stop WordPress from embedding a fresh document from the app host.
 *
 * @param {string} root App origin, including the preview or test server's port.
 * @param {() => string} getBridgePath Path to the current release's built helper HTML.
 * @returns Express middleware for the fixed playground.localhost host pair.
 */
export function wordPressFrameMiddleware(root, getBridgePath) {
	return (req, res, next) => {
		res.set('X-Content-Type-Options', 'nosniff');
		res.set('Cache-Control', 'no-store');
		if (req.hostname === 'wp.playground.localhost') {
			// This untrusted helper may sit below an external embedder.
			// It exposes HTTP transport only, never the app's filesystem API.
			if (req.path === '/wordpress-bridge.html') {
				// The helper executes shared root-origin modules, never a second copy on wp.
				readFile(getBridgePath(), 'utf8').then(
					(html) =>
						res
							.type('html')
							.send(
								html.replace(
									/((?:src|href)=["'])\/(?!\/)/g,
									`$1${root}/`
								)
							),
					() => res.sendStatus(404)
				);
				return;
			}
			if (req.path === '/sw.js') {
				return res.type('js').send(`import "${root}/sw.js";`);
			}
			if (
				req.path.startsWith('/assets/') &&
				req.query['playground-site-thumbnail-worker'] === '1'
			) {
				return res
					.type('js')
					.send(
						`importScripts(${JSON.stringify(root + req.originalUrl)});`
					);
			}
			// Scoped WordPress responses come only from this origin's service worker.
			return res.sendStatus(404);
		}
		if (req.hostname !== 'playground.localhost') return res.sendStatus(404);
		// Do not add COOP here: OAuth must retain its opener after cross-origin navigation.
		if (req.path.startsWith('/scope:')) return res.sendStatus(404);
		if (
			req.path.endsWith('.js') ||
			req.path.startsWith('/assets/') ||
			/^\/wp-[^/]+\//.test(req.path)
		) {
			res.set('Access-Control-Allow-Origin', '*');
			// Cloned navigations can preflight with headers such as Upgrade-Insecure-Requests.
			res.set('Access-Control-Allow-Headers', '*');
			res.set('Access-Control-Allow-Methods', 'GET, HEAD');
			res.set('Cross-Origin-Resource-Policy', 'cross-origin');
			res.set('Cache-Control', 'public, max-age=3600');
			if (req.method === 'OPTIONS') return res.sendStatus(204);
		}
		next();
	};
}
