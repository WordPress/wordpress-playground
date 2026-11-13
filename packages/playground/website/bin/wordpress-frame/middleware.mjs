import express from 'express';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Serve an installed web root on the app and WordPress hostnames, as WP Cloud does.
 *
 * Existing files are served directly on both hosts, like Nginx, and hidden paths
 * are denied. Missing paths go to a local PHP server running the installed
 * custom-redirects.php, which applies the deployment's host rules. Unknown hosts
 * get 404 so the preview cannot expose the app under another hostname.
 *
 * The release-switching tests also serve archived single-origin builds, which
 * have no custom-redirects.php; those are served as plain static directories.
 * Resolve the directory on every request so a test's release switch applies.
 *
 * @param {() => string} getWebRoot Current web root.
 * @param {string[]} hostnames Hostnames this preview answers.
 */
export function wordPressFrameMiddleware(getWebRoot, hostnames) {
	const fallbacks = new Map();
	return async (req, res, next) => {
		if (!hostnames.includes(req.hostname)) return res.sendStatus(404);
		const webRoot = getWebRoot();
		res.set('X-Content-Type-Options', 'nosniff');
		express.static(webRoot, {
			dotfiles: 'deny',
			index: false,
			redirect: false,
			setHeaders(response, file) {
				// Root copies change with each release; release files never do.
				response.setHeader(
					'Cache-Control',
					file.includes('/releases/')
						? 'public, max-age=31536000, immutable'
						: 'no-store'
				);
			},
		})(req, res, async () => {
			if (!existsSync(join(webRoot, 'custom-redirects.php'))) {
				return next();
			}
			if (!fallbacks.has(webRoot)) {
				fallbacks.set(webRoot, startPhpFallback(webRoot));
			}
			proxy(req, res, await fallbacks.get(webRoot));
		});
	};
}

/** Run the installed PHP entry for missing paths, as WP Cloud's fallback does. */
async function startPhpFallback(webRoot) {
	const router = join(
		await mkdtemp(join(tmpdir(), 'playground-preview-')),
		'wpcloud.php'
	);
	await writeFile(
		router,
		`<?php
function __atomic_env_define( $name ) {}
class Atomic_Persistent_Data {}
require ${JSON.stringify(join(webRoot, 'custom-redirects.php'))};
`
	);
	const reservation = createServer();
	reservation.listen(0, '127.0.0.1');
	await once(reservation, 'listening');
	const { port } = reservation.address();
	await new Promise((resolve) => reservation.close(resolve));
	const php = spawn(
		'php',
		['-S', `127.0.0.1:${port}`, '-t', webRoot, router],
		{
			stdio: ['ignore', 'ignore', 'pipe'],
			env: { ...process.env, PHP_CLI_SERVER_WORKERS: '4' },
		}
	);
	process.once('exit', () => php.kill());
	await once(php.stderr, 'data');
	return port;
}

function proxy(req, res, port) {
	const upstream = httpRequest(
		{
			hostname: '127.0.0.1',
			port,
			path: req.originalUrl,
			method: req.method,
			headers: req.headers,
		},
		(response) => {
			res.writeHead(response.statusCode, response.headers);
			response.pipe(res);
		}
	);
	upstream.on('error', (error) => res.destroy(error));
	req.pipe(upstream);
}
