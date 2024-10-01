/* eslint-disable no-console */
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

	if (!path.isAbsolute(oldVersionDirectory)) {
		oldVersionDirectory = path.resolve(oldVersionDirectory);
	}
	if (!path.isAbsolute(newVersionDirectory)) {
		newVersionDirectory = path.resolve(newVersionDirectory);
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

// @ts-ignore
if (import.meta.url === import.meta.resolve(process.argv[1])) {
	const [, , oldVersionDir, newVersionDir, port] = process.argv;

	if (!oldVersionDir || !newVersionDir || !port) {
		console.error(
			'Usage: node version-switching-server.js <oldVersionDir> <newVersionDir> <port>'
		);
		process.exit(1);
	}

	const server = await startVersionSwitchingServer({
		oldVersionDirectory: oldVersionDir,
		newVersionDirectory: newVersionDir,
		port: parseInt(port, 10),
	});

	server.switchToNewVersion();
	console.log('Version switching server started');
}
