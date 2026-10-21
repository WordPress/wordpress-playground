import { readFile } from 'node:fs/promises';

/** Apply the same origin boundary to the preview and version-switching servers. */
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
