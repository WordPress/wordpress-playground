/**
 * Test the staging router's HTTP responses using a real local PHP server.
 *
 * Temporary build files and different Host headers exercise the app/WordPress
 * split, traversal rejection, shared-asset headers, and ranged downloads without
 * changing DNS or contacting staging. This checks PHP routing only: WP Cloud's
 * hostname configuration, TLS, and Nginx deny rule still need deployment checks.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdtemp, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = dirname(fileURLToPath(import.meta.url));
const app = 'https://www.playground.example';
const wordpress = 'https://wp.playground.example';
const temporary = await mkdtemp(join(tmpdir(), 'playground-wpcloud-'));
const files = join(temporary, 'files');
await mkdir(join(files, 'assets'), { recursive: true });
await cp(join(source, 'router.php'), join(temporary, 'router.php'));
await cp(
	join(source, '../custom-redirects-lib.php'),
	join(temporary, 'custom-redirects-lib.php')
);
await cp(
	join(source, '../../../php-wasm/universal/src/lib/mime-types.json'),
	join(temporary, 'mime-types.json')
);
await writeFile(join(files, 'index.html'), '<title>Trusted app</title>');
await writeFile(join(files, 'api.html'), '<title>Trusted API</title>');
await writeFile(
	join(files, 'assets/runtime.wasm'),
	new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])
);
await writeFile(
	join(files, 'wordpress-bridge.html'),
	'<script src="/assets/bridge.js"></script>'
);
await writeFile(join(temporary, 'secret.txt'), 'must not be served');
await writeFile(
	join(temporary, 'entry.php'),
	`<?php require __DIR__.'/router.php'; playground_serve_wordpress_frame(__DIR__.'/files', ${JSON.stringify(app)}, ${JSON.stringify(wordpress)});`
);
const reservation = createServer();
reservation.listen(0, '127.0.0.1');
await once(reservation, 'listening');
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const server = spawn('php', [
	'-S',
	`127.0.0.1:${port}`,
	join(temporary, 'entry.php'),
]);
try {
	await once(server.stderr, 'data');
	// Existing embeds can omit the referrer and use their unchanged app/API URLs.
	for (const path of ['/', '/api.html']) {
		for (const referrer of ['', 'https://external.example/article']) {
			const response = await request(path, app, { Referer: referrer });
			assert.equal(response.status, 200);
			assert.doesNotMatch(
				response.headers.get('content-security-policy') || '',
				/(?:^|;)\s*frame-ancestors(?:\s|$)/i
			);
			assert.equal(response.headers.get('x-frame-options'), null);
			assert.match(response.headers.get('cache-control'), /no-store/);
		}
	}
	for (const host of [app, wordpress]) {
		for (const path of ['/scope:test/', '/%2e%2e%2fsecret.txt']) {
			assert.equal((await request(path, host)).status, 404);
		}
	}
	for (const path of [
		'/',
		'/api.html',
		'/remote.html',
		'/assets/runtime.wasm',
	]) {
		assert.equal((await request(path, wordpress)).status, 404);
	}
	const bridge = await request('/wordpress-bridge.html', wordpress);
	assert.equal(bridge.status, 200);
	assert.match(
		await bridge.text(),
		/src="https:\/\/www.playground.example\/assets\/bridge.js"/
	);
	const workerSource = await (await request('/sw.js', wordpress)).text();
	assert.equal(
		JSON.parse(workerSource.slice('import '.length, -1)),
		app + '/sw.js'
	);
	const range = await request('/assets/runtime.wasm', app, {
		Range: 'bytes=1-3',
	});
	assert.equal(range.status, 206);
	assert.equal(range.headers.get('content-range'), 'bytes 1-3/8');
	assert.equal(range.headers.get('access-control-allow-origin'), '*');
	assert.equal(range.headers.get('content-type'), 'application/wasm');
	assert.deepEqual(
		new Uint8Array(await range.arrayBuffer()),
		new Uint8Array([97, 115, 109])
	);
	const head = await request('/assets/runtime.wasm', app, {}, 'HEAD');
	assert.equal(head.headers.get('content-length'), '8');
	assert.equal((await head.arrayBuffer()).byteLength, 0);
	const options = await request('/assets/runtime.wasm', app, {}, 'OPTIONS');
	assert.equal(options.status, 204);
	assert.equal(options.headers.get('access-control-allow-origin'), '*');
	assert.equal(
		(await request('/assets/runtime.wasm', app, { Range: 'bytes=100-' }))
			.status,
		416
	);
	await rename(files, files + '-unavailable');
	assert.ok((await request('/etc/passwd', app)).status >= 400);
	console.log(
		'WP Cloud router: unchanged embed URLs, host/path boundaries, shared assets, ranges and HEAD/OPTIONS passed.'
	);
} finally {
	server.kill();
	await once(server, 'exit');
	await rm(temporary, { recursive: true, force: true });
}

/**
 * Send a request to local PHP while selecting a configured public host via Host.
 *
 * The origin argument chooses which router branch runs, not where to connect;
 * all traffic goes to the temporary loopback server, without HTTPS or public DNS.
 * Use node:http's raw path so encoded traversal probes reach PHP unchanged rather
 * than being normalized by a fetch URL parser. Buffer these small fixtures into
 * a Response so assertions can inspect status, headers, and exact range bytes.
 */
function request(path, origin, headers = {}, method = 'GET') {
	return new Promise((resolve, reject) => {
		const outgoing = httpRequest(
			{
				hostname: '127.0.0.1',
				port,
				path,
				method,
				headers: { Host: new URL(origin).host, ...headers },
			},
			(incoming) => {
				const chunks = [];
				incoming.on('data', (chunk) => chunks.push(chunk));
				incoming.on('end', () => {
					const bytes = Buffer.concat(chunks);
					resolve(
						new Response(bytes.length ? bytes : null, {
							status: incoming.statusCode,
							headers: incoming.headers,
						})
					);
				});
			}
		);
		outgoing.on('error', reject);
		outgoing.end();
	});
}
