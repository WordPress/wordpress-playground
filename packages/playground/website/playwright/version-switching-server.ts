/* eslint-disable no-console */
import type http from 'http';
import express from 'express';
import path from 'path';
import process from 'process';
import { wordPressFrameMiddleware } from '../bin/wordpress-frame/middleware.mjs';

/**
 * Serve old, intermediate, and new builds at one address to test deployment upgrades.
 *
 * Start with oldVersionDirectory. The returned controls, or /switch-versions/ URLs,
 * change which directory serves subsequent requests without restarting the server
 * or reloading an open page. Tests can therefore leave an old app running while
 * its service worker and later asset requests encounter a newly deployed build.
 * Serving only the newest build from the start would miss those upgrade failures.
 *
 * In the split-origin lane, install the same host routing as the normal preview
 * before serving static files. Its helper-path callback reads staticDirectory on
 * every request: after a release switch, both the app and wordpress-bridge.html
 * must come from the selected build. Do not keep serving the old helper with new
 * app modules or let this test server expose WordPress HTML on the app host.
 *
 * The cache control only changes HTTP response headers; it does not clear browser
 * HTTP caches or service-worker CacheStorage. Tests manage those separately.
 * Call kill() during test cleanup to close the listener and remove signal hooks.
 */
export async function startVersionSwitchingServer({
	port = 7999,
	oldVersionDirectory,
	newVersionDirectory,
	midVersionDirectory,
}) {
	const app = express();

	if (!path.isAbsolute(oldVersionDirectory)) {
		oldVersionDirectory = path.resolve(oldVersionDirectory);
	}
	if (!path.isAbsolute(newVersionDirectory)) {
		newVersionDirectory = path.resolve(newVersionDirectory);
	}

	let staticDirectory = oldVersionDirectory;
	let httpCacheEnabled = true;

	/**
	 * Let upgrade tests opt out of storing these responses in the HTTP cache.
	 * This affects later responses only, not entries already stored by a browser.
	 */
	const noCacheMiddleware = (req, res, next) => {
		if (!httpCacheEnabled) {
			res.setHeader(
				'Cache-Control',
				'no-cache, no-store, must-revalidate'
			);
			res.setHeader('Pragma', 'no-cache');
			res.setHeader('Expires', '0');
		}
		next();
	};

	if (process.env.PLAYWRIGHT_WORDPRESS_FRAME === '1') {
		app.use(
			wordPressFrameMiddleware(
				`http://playground.localhost:${port}`,
				() => path.join(staticDirectory, 'wordpress-bridge.html')
			)
		);
	}
	app.use(noCacheMiddleware);
	app.use((req, res, next) => {
		if (req.method === 'GET' && req.path.startsWith('/switch-versions/')) {
			const version = req.path.split('/').pop();
			staticDirectory = path.resolve(
				version === 'old'
					? oldVersionDirectory
					: version === 'mid'
						? midVersionDirectory
						: newVersionDirectory
			);
			res.send('Version switched');
			next();
			return;
		}
		express.static(staticDirectory)(req, res, next);
	});

	const server = await new Promise<http.Server>((resolve, reject) => {
		const _server = app.listen(port, () => {
			resolve(_server!);
		});
	});

	const sigintHandler = () => {
		server.close();
	};

	const sigtermHandler = () => {
		server.close();
	};

	process.on('SIGINT', sigintHandler);
	process.on('SIGTERM', sigtermHandler);

	return {
		switchToNewVersion: () => {
			staticDirectory = newVersionDirectory;
		},
		switchToMidVersion: () => {
			staticDirectory = midVersionDirectory;
		},
		switchToOldVersion: () => {
			staticDirectory = oldVersionDirectory;
		},
		setHttpCacheEnabled: (enabled: boolean) => {
			httpCacheEnabled = enabled;
		},
		kill: () => {
			server.close();
			process.off('SIGINT', sigintHandler);
			process.off('SIGTERM', sigtermHandler);
		},
	};
}
