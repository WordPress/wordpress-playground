import http from 'http';
import express from 'express';
import path from 'path';
import process from 'process';

export async function startVersionSwitchingServer({
	port = 7999,
	oldVersionDirectory,
	newVersionDirectory,
}) {
	const app = express();

	if (
		!path.isAbsolute(oldVersionDirectory) ||
		!path.isAbsolute(newVersionDirectory)
	) {
		throw new Error('Error: Directories must be absolute paths.');
	}

	let staticDirectory = oldVersionDirectory;
	let httpCacheEnabled = true;

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

	app.use(noCacheMiddleware);

	app.use((req, res, next) => {
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
