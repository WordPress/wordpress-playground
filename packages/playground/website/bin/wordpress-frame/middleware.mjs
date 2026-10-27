import express from 'express';
import { isWordPressBridgePath } from '../../../remote/src/lib/wordpress-bridge-path.ts';

/**
 * Route the local app and WordPress hosts before either server serves static files.
 *
 * For example, playground.localhost:9500 serves the SPA, remote.html, PHP bundles,
 * and WordPress downloads. wp.playground.localhost:9500 serves only the hidden
 * HTTP-request helper, a service-worker loader, and the thumbnail-worker
 * loaders. Other WordPress-host requests return 404 from this server: a running
 * site's /scope:site-a/ pages come from the browser's WordPress service worker.
 *
 * Reject /scope:... on the app host too. Otherwise user HTML could load on the
 * same origin as the SPA and read its OPFS. Reject unknown hosts rather than
 * letting the static-file middleware expose the app under another hostname.
 * This middleware must therefore run before every express.static() handler.
 *
 * On the first visit there is no WordPress service worker yet. Serve the small
 * built wordpress-sandbox/ directory, just as the PHP host gate does. Its helper
 * and loaders already import app-origin scripts, keeping one public bundle copy.
 * CORS and CORP headers on app assets allow those cross-origin module fetches.
 * The helper may sit below an external embedder. It exposes HTTP transport only,
 * never the app filesystem API.
 *
 * Both the normal preview and the release-switching test server use these rules.
 * Resolve getSandboxDirectory() on each request so switching releases switches
 * the helper and loaders too; a captured initial path would mix build versions.
 * This is host/path routing, not authorization between WordPress sites. It does
 * not stop WordPress from embedding a fresh document from the app host.
 *
 * @param {() => string} getSandboxDirectory Current release's sandbox document root.
 * @returns Express middleware for the fixed playground.localhost host pair.
 */
export function wordPressFrameMiddleware(getSandboxDirectory) {
	return (req, res, next) => {
		res.set('X-Content-Type-Options', 'nosniff');
		res.set('Cache-Control', 'no-store');
		if (req.hostname === 'wp.playground.localhost') {
			// All build-keyed helper URLs serve the current built helper file.
			// Older workers do not intercept a newer build's path.
			if (isWordPressBridgePath(req.path)) {
				const search = new URL(req.url, 'http://localhost').search;
				req.url = '/wordpress-bridge.html' + search;
			}
			// Serve only files in the sandbox root, without app fallbacks or indexes.
			return express.static(getSandboxDirectory(), {
				index: false,
				redirect: false,
				cacheControl: false,
			})(req, res, () => res.sendStatus(404));
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
