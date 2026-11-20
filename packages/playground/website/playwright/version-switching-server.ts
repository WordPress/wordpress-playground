/* eslint-disable no-console */
import type http from 'http';
import express from 'express';
import type { RequestHandler } from 'express';
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
 * In the split-origin lane, serve each directory as the normal preview does: an
 * installed release web root through its PHP entry for missing paths, and the
 * archived single-origin builds as plain static directories. The callback reads
 * staticDirectory on every request, so a release switch applies immediately.
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
}: {
	port?: number;
	oldVersionDirectory: string;
	newVersionDirectory: string;
	midVersionDirectory: string;
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
	const noCacheMiddleware: RequestHandler = (req, res, next) => {
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

	app.use(noCacheMiddleware);
	app.use((req, res, next) => {
		if (req.method === 'GET' && req.path.startsWith('/switch-versions/')) {
			if (
				process.env.PLAYWRIGHT_WORDPRESS_FRAME === '1' &&
				!['playground.localhost', 'wp.playground.localhost'].includes(
					req.hostname
				)
			)
				return res.sendStatus(404);
			const version = req.path.split('/').pop();
			staticDirectory = path.resolve(
				version === 'old'
					? oldVersionDirectory
					: version === 'mid'
						? midVersionDirectory
						: newVersionDirectory
			);
			res.send('Version switched');
			return;
		}
		next();
	});
	if (process.env.PLAYWRIGHT_WORDPRESS_FRAME === '1') {
		app.use(
			wordPressFrameMiddleware(
				() => staticDirectory,
				['playground.localhost', 'wp.playground.localhost']
			)
		);
	}
	app.use((req, res, next) =>
		express.static(staticDirectory)(req, res, next)
	);

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
