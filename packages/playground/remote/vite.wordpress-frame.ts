import type { Plugin } from 'vite';
import { localDevelopmentHostnames } from './src/lib/dev-server';
import { isWordPressBridgePath } from './src/lib/wordpress-bridge-path';

/**
 * Use the remote Vite listener as WordPress's origin during website development.
 *
 * The app on :5400 proxies its runtime-module requests to this server on :4400,
 * preserving Host: 127.0.0.1:5400. Let those requests reach Vite. A browser request
 * to :4400 uses a different Host and may load only the HTTP helper and worker
 * loaders, never remote.html, api.html, or arbitrary source modules.
 *
 * Generate the helper with an app-origin source-module URL. Unlike a production
 * build, Vite has not extracted the source HTML's inline script; serving it
 * unchanged would make the bridge identify :4400 as its app parent. Its service
 * worker also starts through an app-origin module import, keeping one module graph.
 *
 * This plugin is enabled only by the website's remote dev configuration. Generic
 * remote, Personal WP, and sync development retain their existing server behavior.
 * Non-loopback forwarded hosts also keep that behavior because they cannot rely
 * on the developer's local remote port. This is routing, not HTTP authorization
 * between WordPress sites or a restriction on fresh app/API iframe embeds.
 *
 * @param appOrigin Origin used by the website and its PHP worker.
 * @param wordPressOrigin Direct browser origin of this remote Vite listener.
 */
export function wordPressFrameDevPlugin(
	appOrigin: string,
	wordPressOrigin: string
): Plugin {
	const app = new URL(appOrigin);
	const wordpress = new URL(wordPressOrigin);
	return {
		name: 'wordpress-frame-dev',
		apply: 'serve',
		/** Install before Vite can serve or transform any app document or source file. */
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				let host: URL;
				try {
					host = new URL(`http://${req.headers.host}`);
				} catch {
					res.statusCode = 400;
					res.end('Invalid host');
					return;
				}
				if (!localDevelopmentHostnames.has(host.hostname))
					return next();
				if (host.port === app.port) return next();

				res.setHeader('X-Content-Type-Options', 'nosniff');
				res.setHeader('Cache-Control', 'no-store');
				const url = new URL(req.url!, host);
				// Match the browser's local alias (localhost or 127.0.0.1) on both ports.
				const target = new URL(app);
				target.hostname = host.hostname;
				if (host.port === wordpress.port) {
					if (isWordPressBridgePath(url.pathname)) {
						target.pathname = '/src/lib/wordpress-bridge.ts';
						res.setHeader('Content-Type', 'text/html');
						res.end(
							`<!doctype html><title>WordPress request transport</title><script type="module" src=${JSON.stringify(target.href)}></script>`
						);
						return;
					}
					if (url.pathname === '/sw.js') {
						target.pathname = '/service-worker.ts';
						target.search = '?worker_file&type=module';
						res.setHeader('Content-Type', 'text/javascript');
						res.end(`import ${JSON.stringify(target.href)};`);
						return;
					}
					if (
						url.searchParams.get(
							'playground-site-thumbnail-worker'
						) === '1' &&
						['/assets/', '/@fs/', '/node_modules/'].some((prefix) =>
							url.pathname.startsWith(prefix)
						)
					) {
						target.pathname = url.pathname;
						target.search = url.search;
						res.setHeader('Content-Type', 'text/javascript');
						res.end(
							`importScripts(${JSON.stringify(target.href)});`
						);
						return;
					}
				}
				// Only the browser service worker can synthesize scoped WordPress pages.
				res.statusCode = 404;
				res.end('Not found');
			});
		},
	};
}
