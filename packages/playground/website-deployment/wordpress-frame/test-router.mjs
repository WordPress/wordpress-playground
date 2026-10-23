/**
 * Install releases and test the deployed entry using a real local PHP server.
 *
 * Temporary build files and different Host headers exercise the app/WordPress
 * split, traversal rejection, shared-asset headers, and ranged downloads without
 * changing DNS or contacting public hosts. This checks PHP routing only: WP Cloud's
 * hostname configuration, TLS, and Nginx deny rule still need deployment checks.
 */
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import {
	cp,
	mkdtemp,
	mkdir,
	readFile,
	readdir,
	rename,
	rm,
	writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:net';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const source = dirname(fileURLToPath(import.meta.url));
const app = 'https://playground.wordpress.net';
const wordpress = 'https://wasm.wordpress.net';
const temporary = await mkdtemp(join(tmpdir(), 'playground-wpcloud-'));
const webRoot = join(temporary, 'htdocs');
const deployment = join(temporary, 'website-deployment');
const backups = join(temporary, 'backups');
const upload = join(temporary, 'uploaded-build');
const fakeBin = join(temporary, 'bin');
const run = promisify(execFile);
let server;
let port;
try {
	await cp(join(source, '..'), deployment, { recursive: true });
	await cp(
		join(source, '../../../php-wasm/universal/src/lib/mime-types.json'),
		join(deployment, 'mime-types.json')
	);
	await mkdir(join(upload, 'assets'), { recursive: true });
	await writeFile(join(upload, 'index.html'), '<title>Trusted app</title>');
	await writeFile(join(upload, 'api.html'), '<title>Trusted API</title>');
	await writeFile(
		join(upload, 'remote.html'),
		'<title>Trusted PHP host</title>'
	);
	await writeFile(join(upload, 'sw.js'), '// App service worker');
	await writeFile(
		join(upload, 'assets/runtime.wasm'),
		new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])
	);
	await writeFile(
		join(upload, 'wordpress-bridge.html'),
		'<script src="/assets/bridge.js"></script>'
	);
	// Execute a real native endpoint through the deployed entry, not a PHP fixture.
	await cp(
		join(source, '../../website/public/dynamic-manifest.json.php'),
		join(upload, 'dynamic-manifest.json.php')
	);
	await writeFile(
		join(upload, 'wordpress.html'),
		'<title>WordPress entry</title>'
	);
	await writeFile(
		join(upload, 'iframe-worker.html'),
		'<title>Worker iframe</title>'
	);
	await writeFile(join(upload, 'blueprint-schema.json'), '{}');
	await writeFile(join(upload, 'example-store.zip'), 'archive bytes');
	await writeFile(join(upload, 'assets/thumbnail.js'), '// Thumbnail worker');
	await writeFile(
		join(upload, 'status.php'),
		'<?php echo "native endpoint";'
	);
	await writeFile(
		join(upload, 'plugin-proxy.php'),
		'<?php echo getenv("GITHUB_TOKEN");'
	);
	await cp(
		join(source, '../../website/public/logger.php'),
		join(upload, 'logger.php')
	);
	await mkdir(join(upload, 'builder'));
	await writeFile(join(upload, 'builder/builder.html'), 'Builder');
	await mkdir(join(upload, 'static-files-to-serve-via-php'));
	await writeFile(
		join(upload, 'static-files-to-serve-via-php/set-aside.txt'),
		'set-aside file'
	);
	await mkdir(join(upload, 'tools'));
	await writeFile(
		join(upload, 'tools/index.php'),
		'<?php echo "PHP directory index";'
	);
	await writeFile(join(upload, 'tools/index.html'), 'HTML directory index');
	await mkdir(join(webRoot, 'assets'), { recursive: true });
	const oldEntry = '<?php echo "previous deployment";';
	await writeFile(join(webRoot, 'custom-redirects.php'), oldEntry);
	await writeFile(join(webRoot, 'index.html'), 'old public app');
	await writeFile(join(webRoot, 'assets/old.js'), 'old public script');
	await writeFile(join(temporary, 'secret.txt'), 'must not be served');
	await mkdir(fakeBin);
	// PHP's test server cannot model WP Cloud's Nginx rule or public TLS. Stub only
	// the deployment probes; all requests after activation use the real PHP entry.
	await writeFile(
		join(fakeBin, 'curl'),
		`#!/usr/bin/env node
const assert = require('node:assert/strict');
const { statSync } = require('node:fs');
const { join, basename } = require('node:path');
const url = new URL(process.argv.at(-1));
if (url.pathname === '/sw.js') {
    process.stdout.write(process.env.ALIAS_STATUS || '200');
} else {
    const path = join(process.env.PROBE_ROOT, basename(decodeURIComponent(url.pathname)));
    // Otherwise a 403 might just be mktemp's mode 600, not Nginx's deny rule.
    assert.ok(statSync(path).mode & 0o004);
    process.stdout.write(process.env.PRIVATE_STATUS || '403');
}
`,
		{ mode: 0o755 }
	);
	await writeFile(
		join(fakeBin, 'mv'),
		`#!/bin/bash
if [ "\${FAIL_PUBLIC_MOVE:-}" = 1 ] && [ "$1" = "$PUBLIC_ASSET" ]; then
    echo 'Cannot move public asset' >&2
    exit 1
fi
exec /bin/mv "$@"
`,
		{ mode: 0o755 }
	);
	const install = [
		join(deployment, 'wordpress-frame/install-release.sh'),
		upload,
		webRoot,
		backups,
	];
	const installEnv = {
		...process.env,
		PATH: fakeBin + ':' + process.env.PATH,
		SITE_PHP: 'php',
		PROBE_ROOT: join(webRoot, '.playground-releases'),
	};
	// An interrupted upload can omit a runtime entry even when index.html exists.
	await rename(
		join(upload, 'remote.html'),
		join(upload, 'remote-unavailable.html')
	);
	await assert.rejects(run('bash', install, { env: installEnv }));
	assert.equal(
		await readFile(join(webRoot, 'custom-redirects.php'), 'utf8'),
		oldEntry
	);
	await rename(
		join(upload, 'remote-unavailable.html'),
		join(upload, 'remote.html')
	);
	// A public release URL, alias redirect, or failed public URL must leave the old
	// entry and upload untouched. This catches moving files before the checks run.
	for (const env of [
		{ PRIVATE_STATUS: '200' },
		{ ALIAS_STATUS: '301' },
		{ ALIAS_STATUS: '503' },
	]) {
		await assert.rejects(
			run('bash', install, { env: { ...installEnv, ...env } })
		);
		assert.equal(
			await readFile(join(webRoot, 'custom-redirects.php'), 'utf8'),
			oldEntry
		);
		assert.equal(
			await readFile(join(webRoot, 'index.html'), 'utf8'),
			'old public app'
		);
		assert.equal(
			await readFile(join(upload, 'index.html'), 'utf8'),
			'<title>Trusted app</title>'
		);
		assert.deepEqual(
			await readdir(join(webRoot, '.playground-releases')),
			[]
		);
	}
	// Leaving even one old public asset would bypass the new host checks.
	await assert.rejects(
		run('bash', install, {
			env: {
				...installEnv,
				FAIL_PUBLIC_MOVE: '1',
				PUBLIC_ASSET: join(webRoot, 'assets'),
			},
		})
	);
	assert.equal(
		await readFile(join(webRoot, 'custom-redirects.php'), 'utf8'),
		oldEntry
	);
	assert.equal(
		await readFile(join(webRoot, 'assets/old.js'), 'utf8'),
		'old public script'
	);
	const [failedRelease] = await readdir(
		join(webRoot, '.playground-releases')
	);
	await rename(
		join(webRoot, '.playground-releases', failedRelease, 'files'),
		upload
	);
	await rm(join(webRoot, '.playground-releases', failedRelease), {
		recursive: true,
	});
	await rm(join(backups, failedRelease), { recursive: true });
	await run('bash', install, { env: installEnv });
	const [releaseName] = await readdir(join(webRoot, '.playground-releases'));
	const files = join(webRoot, '.playground-releases', releaseName, 'files');
	assert.equal(
		await readFile(
			join(backups, releaseName, 'custom-redirects.php'),
			'utf8'
		),
		oldEntry
	);
	assert.equal(
		await readFile(join(backups, releaseName, 'assets/old.js'), 'utf8'),
		'old public script'
	);
	assert.deepEqual((await readdir(webRoot)).sort(), [
		'.playground-releases',
		'__wp__',
		'custom-redirects.php',
	]);
	const cli = await run('php', [join(webRoot, 'custom-redirects.php')]);
	assert.equal(cli.stdout, '');
	const reservation = createServer();
	reservation.listen(0, '127.0.0.1');
	await once(reservation, 'listening');
	port = reservation.address().port;
	await new Promise((resolve) => reservation.close(resolve));
	// WP Cloud provides these before loading custom-redirects.php. Use fixture
	// values to exercise the existing persistent-data setup without real secrets.
	const environmentCalls = join(temporary, 'environment-calls.txt');
	const platformEntry = join(temporary, 'wpcloud.php');
	await writeFile(
		platformEntry,
		`<?php
/** Record the environment setup performed before a native endpoint runs. */
function __atomic_env_define($name) {
    file_put_contents(${JSON.stringify(environmentCalls)}, $name . "\\n", FILE_APPEND);
}
class Atomic_Persistent_Data {
    public $GITHUB_TOKEN = 'fixture-token';
}
require ${JSON.stringify(join(webRoot, 'custom-redirects.php'))};
`
	);
	server = spawn('php', [
		'-S',
		`127.0.0.1:${port}`,
		'-t',
		webRoot,
		platformEntry,
	]);
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
	// The sandbox gate must not replace the shared app handler. These requests
	// must keep using its rewrite, redirect, header, and PHP setup paths.
	for (const [path, location, status] of [
		['/docs', 'https://wordpress.github.io/wordpress-playground/', 301],
		['/wordpress', 'wordpress.html', 301],
		['/builder/', 'builder.html', 301],
		['/builder/index.php', 'builder.html', 301],
	]) {
		const response = await request(path, app);
		assert.equal(response.status, status, path);
		assert.equal(response.headers.get('location'), location, path);
	}
	const conditionalRedirect = await request('/wordpress.html', app, {
		Referer: 'https://wordpress.org/example/',
	});
	assert.equal(conditionalRedirect.status, 302);
	assert.equal(conditionalRedirect.headers.get('location'), '/index.html');
	for (const referrer of ['', 'https://external.example/']) {
		const response = await request('/wordpress.html', app, {
			Referer: referrer,
		});
		assert.equal(response.status, 200);
		assert.equal(await response.text(), '<title>WordPress entry</title>');
		assert.match(response.headers.get('cache-control'), /no-cache/);
		assert.equal(response.headers.get('a8c-edge-cache'), null);
	}
	const builder = await request('/builder?example=1', app);
	assert.equal(builder.status, 301);
	assert.equal(
		new URL(builder.headers.get('location'), app + '/builder').pathname,
		'/builder/'
	);
	assert.equal(
		new URL(builder.headers.get('location'), app + '/builder').search,
		'?example=1'
	);
	assert.equal(
		await (await request('/tools/', app)).text(),
		'PHP directory index'
	);
	assert.equal(
		await (await request('/status.php', app)).text(),
		'native endpoint'
	);
	assert.equal(
		await (await request('/set-aside.txt', app)).text(),
		'set-aside file'
	);
	const proxy = await request('/plugin-proxy', app);
	assert.equal(proxy.status, 200);
	assert.equal(await proxy.text(), 'fixture-token');
	assert.match(await readFile(environmentCalls, 'utf8'), /DB_PASSWORD/);
	const callsBeforeHead = await readFile(environmentCalls, 'utf8');
	assert.equal((await request('/logger.php', app, {}, 'HEAD')).status, 200);
	assert.equal(await readFile(environmentCalls, 'utf8'), callsBeforeHead);
	const workerFrame = await request('/iframe-worker.html', app);
	assert.equal(workerFrame.headers.get('origin-agent-cluster'), '?1');
	const schema = await request('/blueprint-schema.json', app);
	assert.equal(schema.headers.get('access-control-allow-origin'), '*');
	assert.match(schema.headers.get('cache-control'), /no-store/);
	const archive = await request('/example-store.zip', app);
	assert.equal(archive.headers.get('content-encoding'), 'identity');
	assert.equal(archive.headers.get('access-control-allow-origin'), '*');
	assert.ok(archive.headers.get('last-modified'));
	assert.equal(
		(await request('/assets/runtime.wasm', app)).headers.get(
			'a8c-edge-cache'
		),
		'cache'
	);
	for (const path of [
		'/docs',
		'/wordpress.html',
		'/tools/',
		'/status.php',
		'/plugin-proxy',
		'/assets/thumbnail.js',
		'/remote.html?playground-site-thumbnail-worker=1',
	]) {
		assert.equal((await request(path, wordpress)).status, 404, path);
	}
	const bridge = await request('/wordpress-bridge.html', wordpress);
	assert.equal(bridge.status, 200);
	assert.match(
		await bridge.text(),
		/src="https:\/\/playground.wordpress.net\/assets\/bridge.js"/
	);
	const workerSource = await (await request('/sw.js', wordpress)).text();
	assert.equal(
		JSON.parse(workerSource.slice('import '.length, -1)),
		app + '/sw.js'
	);
	const thumbnail = await request(
		'/assets/thumbnail.js?playground-site-thumbnail-worker=1',
		wordpress
	);
	assert.equal(thumbnail.status, 200);
	assert.match(await thumbnail.text(), /importScripts/);
	for (const path of [
		'/assets/runtime.wasm?playground-site-thumbnail-worker=1',
		'/assets/missing.js?playground-site-thumbnail-worker=1',
		'/assets/../status.php?playground-site-thumbnail-worker=1',
	]) {
		assert.equal((await request(path, wordpress)).status, 404, path);
	}
	assert.equal(
		(
			await request('/api.html', wordpress, {
				Host: 'WASM.WordPress.NET:443',
			})
		).status,
		404
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
	const manifest = await request(
		'/dynamic-manifest.json.php?app_name=Deployment',
		app
	);
	assert.equal(manifest.status, 200);
	assert.equal((await manifest.json()).name, 'Deployment');
	for (const host of [app, wordpress]) {
		assert.equal((await request('/assets/old.js', host)).status, 404);
		assert.equal(
			(
				await request(
					'/.playground-releases/' +
						releaseName +
						'/files/index.html',
					host
				)
			).status,
			404
		);
	}
	// A later deployment switches the public entry but retains both the previous
	// entry and its complete private release for rollback and in-flight requests.
	await cp(files, upload, { recursive: true });
	await writeFile(join(upload, 'index.html'), '<title>Next release</title>');
	const previousEntry = await readFile(
		join(webRoot, 'custom-redirects.php'),
		'utf8'
	);
	await run('bash', install, { env: installEnv });
	assert.equal(
		await (await request('/', app)).text(),
		'<title>Next release</title>'
	);
	assert.equal(
		await readFile(join(files, 'index.html'), 'utf8'),
		'<title>Trusted app</title>'
	);
	const nextRelease = (
		await readdir(join(webRoot, '.playground-releases'))
	).find((name) => name !== releaseName);
	assert.equal(
		await readFile(
			join(backups, nextRelease, 'custom-redirects.php'),
			'utf8'
		),
		previousEntry
	);
	await rename(
		join(webRoot, '.playground-releases', nextRelease, 'files'),
		join(webRoot, '.playground-releases', nextRelease, 'unavailable')
	);
	assert.ok((await request('/etc/passwd', app)).status >= 400);
	console.log(
		'WP Cloud deployment: preflight failures, private install, real entry, host/path boundaries, native PHP, shared assets, ranges, HEAD/OPTIONS and release switching passed.'
	);
} finally {
	if (server) {
		server.kill();
		await once(server, 'exit');
	}
	await rm(temporary, { recursive: true, force: true });
}

/**
 * Send a request to local PHP while selecting a configured public host via Host.
 *
 * The origin selects the sandbox gate or normal app handling, not where to connect;
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
