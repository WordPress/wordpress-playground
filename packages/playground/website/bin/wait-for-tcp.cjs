#!/usr/bin/env node

/**
 * Tiny port-readiness check used by `npm run dev` to make sure the
 * remote dev server (port 4400) is accepting connections before the
 * main website server starts proxying /manifest.json and friends to
 * it. Without it, the very first request after `npm run dev` races
 * the remote server's startup and hits ECONNREFUSED, surfaced by
 * vite as a confusing `http proxy error: /manifest.json` log line
 * even though everything self-heals on the next request.
 *
 * Usage: node wait-for-tcp.cjs <host> <port> [timeoutMs]
 */

const net = require('net');

const host = process.argv[2];
const port = Number(process.argv[3]);
const timeoutMs = Number(process.argv[4] ?? 30000);

if (!host || !Number.isFinite(port)) {
	console.error('usage: wait-for-tcp.cjs <host> <port> [timeoutMs]');
	process.exit(2);
}

const start = Date.now();

function tryOnce() {
	const socket = net.connect(port, host);
	socket.once('connect', () => {
		socket.end();
		process.exit(0);
	});
	socket.once('error', () => {
		socket.destroy();
		if (Date.now() - start > timeoutMs) {
			console.error(
				`wait-for-tcp: timed out after ${timeoutMs}ms waiting for ${host}:${port}`
			);
			process.exit(1);
		}
		setTimeout(tryOnce, 200);
	});
}

tryOnce();
