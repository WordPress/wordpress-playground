import express from 'express';
import { isWordPressBridgePath } from '../../../remote/src/lib/wordpress-bridge-path.ts';
import { getReleaseRoot } from '../../../common/src/public-release.ts';
import { existsSync, readFileSync } from 'node:fs';
import { joinPaths as join } from '../../../../php-wasm/util/src/lib/paths.ts';

/**
 * Serve the same installed static release on the app and WordPress hostnames.
 * Scoped WordPress pages come from the browser worker, never the static server.
 * Reject unknown hosts and app-origin scoped URLs before express.static().
 *
 * The release-switching tests also serve archived builds. Those retain their
 * bootstrap-only sandbox directory and cross-origin asset headers below. Resolve
 * the directory on every request so a test's release switch changes the layout too.
 *
 * @param {() => string} getSandboxDirectory Current public root or archived sandbox root.
 * @returns Express middleware for the fixed playground.wordpress.localhost host pair.
 */
export function wordPressFrameMiddleware(getSandboxDirectory) {
	return (req, res, next) => {
		const directory = getSandboxDirectory();
		if (
			existsSync(join(directory, 'index.html')) &&
			readFileSync(join(directory, 'index.html'), 'utf8').includes(
				'id="playground-release"'
			)
		) {
			return servePublicRelease(directory, req, res, next);
		}
		res.set('X-Content-Type-Options', 'nosniff');
		res.set('Cache-Control', 'no-store');
		if (req.hostname === 'wpsandbox.wordpress.localhost') {
			// Versions in these URLs bypass workers installed by a different release.
			// They do not select a release from disk: serve the preview's selected
			// sandbox helper, which already names that release's scripts.
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
		if (req.hostname !== 'playground.wordpress.localhost')
			return res.sendStatus(404);
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

/** Model Nginx serving the same public files on both origins, without PHP or internal CORS. */
function servePublicRelease(directory, req, res, next) {
	if (
		![
			'playground.wordpress.localhost',
			'wpsandbox.wordpress.localhost',
		].includes(req.hostname)
	) {
		return res.sendStatus(404);
	}
	res.set('X-Content-Type-Options', 'nosniff');
	if (req.path.startsWith('/scope:') || req.path.endsWith('.php'))
		return res.sendStatus(404);
	if (
		!getReleaseRoot(new URL(req.url, 'http://localhost')) &&
		isWordPressBridgePath(req.path)
	) {
		const url = new URL(req.url, 'http://localhost');
		req.url = '/wordpress-bridge.html' + url.search;
	}
	if (
		req.path.startsWith('/client/') ||
		req.path === '/blueprint-schema.json'
	) {
		res.set('Access-Control-Allow-Origin', '*');
	}
	const options = {
		dotfiles: 'deny',
		maxAge: '1h',
		setHeaders(response, file) {
			if (
				file.endsWith('bootstrap.js') ||
				(!file.includes('/releases/') && file.endsWith('.html'))
			) {
				response.setHeader('Cache-Control', 'no-store');
			}
		},
	};
	express.static(directory, options)(req, res, () => {
		const release = JSON.parse(
			readFileSync(join(directory, 'index.html'), 'utf8').match(
				/<script id="playground-release" type="application\/json">(.*?)<\/script>/s
			)[1]
		);
		req.url = `/releases/${release.release}${req.url}`;
		express.static(directory, options)(req, res, next);
	});
}
