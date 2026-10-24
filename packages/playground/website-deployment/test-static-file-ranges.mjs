/**
 * Check the static-file sender through PHP's real HTTP stack.
 *
 * Fixed fixture paths stand in for files already validated by the request
 * handler. Check exact bytes and HTTP metadata, including full-response fallback
 * for range forms we do not implement. No build, DNS, or WP Cloud access is used.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const temporary = await mkdtemp(join(tmpdir(), 'playground-byte-ranges-'));
const bytes = '0123456789';
let server;
let port;
try {
	await writeFile(join(temporary, 'fixture.bin'), bytes);
	await writeFile(join(temporary, 'empty.bin'), '');
	await writeFile(
		join(temporary, 'entry.php'),
		`<?php
require ${JSON.stringify(fileURLToPath(new URL('./custom-redirects-lib.php', import.meta.url)))};
header('Content-Type: application/octet-stream');
playground_serve_static_file(__DIR__ . ($_SERVER['REQUEST_URI'] === '/empty' ? '/empty.bin' : '/fixture.bin'));
`
	);
	const reservation = createServer();
	reservation.listen(0, '127.0.0.1');
	await once(reservation, 'listening');
	port = reservation.address().port;
	await new Promise((resolve) => reservation.close(resolve));
	server = spawn('php', [
		'-S',
		`127.0.0.1:${port}`,
		join(temporary, 'entry.php'),
	]);
	await once(server.stderr, 'data');

	const full = await request();
	assert.equal(full.status, 200);
	assert.equal(full.headers.get('accept-ranges'), 'bytes');
	assert.equal(full.headers.get('content-length'), '10');
	assert.equal(await full.text(), bytes);
	for (const [range, start, end] of [
		['bytes=1-3', 1, 3],
		['bytes=4-', 4, 9],
		['bytes=8-99', 8, 9],
		['bytes=0-0', 0, 0],
		['BYTES=1-3', 1, 3],
		['bytes=8-999999999999999999999999', 8, 9],
	]) {
		const response = await request({ Range: range });
		assert.equal(response.status, 206, range);
		assert.equal(
			response.headers.get('content-range'),
			`bytes ${start}-${end}/10`,
			range
		);
		assert.equal(
			response.headers.get('content-length'),
			String(end - start + 1),
			range
		);
		assert.equal(await response.text(), bytes.slice(start, end + 1), range);
	}
	for (const range of [
		'bytes=10-',
		'bytes=3-1',
		'bytes=999999999999999999999999-',
	]) {
		const response = await request({ Range: range });
		assert.equal(response.status, 416, range);
		assert.equal(
			response.headers.get('content-range'),
			'bytes */10',
			range
		);
		assert.equal(response.headers.get('content-length'), '0', range);
		assert.equal(await response.text(), '', range);
	}
	// A valid multipart or suffix request is not an unsatisfiable single range.
	// Ignoring it keeps clients able to retrieve the full resource instead.
	for (const headers of [
		{ Range: 'bytes=0-1,4-5' },
		{ Range: 'bytes=-4' },
		{ Range: 'items=1-3' },
		{ Range: 'bytes=invalid' },
		{ Range: 'bytes=1-3', 'If-Range': '"some-other-version"' },
	]) {
		const response = await request(headers);
		assert.equal(response.status, 200, JSON.stringify(headers));
		assert.equal(response.headers.get('content-range'), null);
		assert.equal(response.headers.get('content-length'), '10');
		assert.equal(await response.text(), bytes);
	}
	for (const headers of [{}, { Range: 'bytes=1-3' }]) {
		const response = await request(headers, 'HEAD');
		assert.equal(response.status, 200);
		assert.equal(response.headers.get('content-range'), null);
		assert.equal(response.headers.get('content-length'), '10');
		assert.equal(await response.text(), '');
	}
	const post = await request({ Range: 'bytes=1-3' }, 'POST');
	assert.equal(post.status, 200);
	assert.equal(await post.text(), bytes);
	const empty = await request({}, 'GET', '/empty');
	assert.equal(empty.status, 200);
	assert.equal(empty.headers.get('content-length'), '0');
	assert.equal(await empty.text(), '');
	const emptyRange = await request({ Range: 'bytes=0-' }, 'GET', '/empty');
	assert.equal(emptyRange.status, 416);
	assert.equal(emptyRange.headers.get('content-range'), 'bytes */0');
	assert.equal(await emptyRange.text(), '');
	console.log(
		'Static files: single ranges, full-response fallback, HEAD, and empty files passed.'
	);
} finally {
	if (server) {
		server.kill();
		await once(server, 'exit');
	}
	await rm(temporary, { recursive: true, force: true });
}

/** Send a loopback HTTP request and buffer only the small fixture response. */
function request(headers = {}, method = 'GET', path = '/') {
	return new Promise((resolve, reject) => {
		const outgoing = httpRequest(
			{ hostname: '127.0.0.1', port, path, method, headers },
			(incoming) => {
				const chunks = [];
				incoming.on('data', (chunk) => chunks.push(chunk));
				incoming.on('end', () => {
					const body = Buffer.concat(chunks);
					resolve(
						new Response(body.length ? body : null, {
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
