/** Real installation and HTTP contracts: Nginx-style static delivery precedes native PHP. */
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import {
	mkdtemp,
	mkdir,
	cp,
	writeFile,
	readFile,
	rm,
	chmod,
	symlink,
} from 'node:fs/promises';
import { createServer } from 'node:http';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import express from 'express';

const run = promisify(execFile);
const temporary = await mkdtemp(join(tmpdir(), 'playground-static-release-'));
const deployment = join(temporary, 'deployment');
const upload = join(temporary, 'upload');
const webRoot = join(temporary, 'htdocs');
const backups = join(temporary, 'backups');
const fakeBin = join(temporary, 'bin');
const calls = join(temporary, 'php-calls');
const appOrigin = 'https://app.example';
const wordPressOrigin = 'https://wordpress.example';
let php;
let server;
try {
	await cp(fileURLToPath(new URL('../', import.meta.url)), deployment, {
		recursive: true,
	});
	await cp(
		fileURLToPath(
			new URL(
				'../../../php-wasm/universal/src/lib/mime-types.json',
				import.meta.url
			)
		),
		join(deployment, 'mime-types.json')
	);
	await mkdir(join(upload, 'assets'), { recursive: true });
	await mkdir(webRoot);
	await mkdir(fakeBin);
	for (const name of [
		'index.html',
		'remote.html',
		'api.html',
		'wordpress-bridge.html',
	]) {
		await writeFile(
			join(upload, name),
			'<script type="module" src="/assets/main.js"></script>'
		);
	}
	for (const name of ['app-sw.js', 'sandbox-sw.js'])
		await writeFile(join(upload, name), '// worker');
	await writeFile(join(upload, 'assets/main.js'), '// main');
	await writeFile(join(upload, 'assets/runtime.wasm'), '0123456789');
	await writeFile(
		join(upload, 'status.php'),
		'<?php echo "native endpoint";'
	);
	await cp(
		fileURLToPath(
			new URL(
				'../../website/public/dynamic-manifest.json.php',
				import.meta.url
			)
		),
		join(upload, 'dynamic-manifest.json.php')
	);
	await writeFile(
		join(fakeBin, 'curl'),
		`#!/usr/bin/env node
if (process.argv.includes('-X')) process.exit(process.env.FAIL_PURGE === '1' ? 22 : 0);
process.stdout.write(process.env.PUBLIC_HIDDEN === '1' ? '200' : process.argv.at(-1).includes('/sw.js?') ? '200' : '403');
`
	);
	await chmod(join(fakeBin, 'curl'), 0o755);
	const phpBinary = (await run('which', ['php'])).stdout.trim();
	const env = {
		...process.env,
		PATH: `${fakeBin}:${process.env.PATH}`,
		SITE_PHP: phpBinary,
		SITE_API_BASE: 'https://api.example',
		ATOMIC_SITE_API_KEY: 'test',
		ATOMIC_SITE_ID: 'test',
	};
	const install = (extra = {}) =>
		run(
			'bash',
			[
				join(deployment, 'apply-update.sh'),
				appOrigin,
				wordPressOrigin,
				upload,
				webRoot,
				backups,
			],
			{ env: { ...env, ...extra } }
		);
	await assert.rejects(install({ PUBLIC_HIDDEN: '1' }));
	await assert.rejects(
		run(
			'bash',
			[
				join(deployment, 'apply-update.sh'),
				appOrigin,
				appOrigin,
				upload,
				webRoot,
				backups,
			],
			{ env }
		)
	);
	await symlink(temporary, join(upload, 'leak'));
	await assert.rejects(install());
	await rm(join(upload, 'leak'));
	await install();
	const first = await selector(webRoot);
	assert.equal(first.appOrigin, appOrigin);
	assert.equal(first.wordPressOrigin, wordPressOrigin);
	const root = `/releases/${first.release}`;
	assert.match(
		JSON.parse(
			(await readFile(join(webRoot, root, 'index.html'), 'utf8')).match(
				/id="playground-document">(.*?)<\/script>/s
			)[1]
		),
		new RegExp(`${root}/assets/main.js`)
	);
	assert.match(
		await readFile(join(webRoot, `app-sw-${first.release}.js`), 'utf8'),
		new RegExp(`${root}/app-sw.js`)
	);
	await assert.rejects(readFile(join(webRoot, root, 'status.php')));
	assert.equal(
		await readFile(
			join(
				webRoot,
				'.playground-releases',
				first.release,
				'files/status.php'
			),
			'utf8'
		),
		'<?php echo "native endpoint";'
	);
	const stableRemote = await readFile(join(webRoot, 'remote.html'), 'utf8');
	const validBridge = await readFile(
		join(upload, 'wordpress-bridge.html'),
		'utf8'
	);
	for (const brokenBridge of [
		'<p>No module</p>',
		'<script src="/assets/missing.js"></script>',
	]) {
		await writeFile(join(upload, 'wordpress-bridge.html'), brokenBridge);
		await assert.rejects(install());
		assert.equal((await selector(webRoot)).release, first.release);
		assert.equal(
			await readFile(join(webRoot, 'remote.html'), 'utf8'),
			stableRemote
		);
	}
	await writeFile(join(upload, 'wordpress-bridge.html'), validBridge);

	await writeFile(join(upload, 'sandbox-sw.js'), '');
	await assert.rejects(install());
	assert.equal((await selector(webRoot)).release, first.release);
	await writeFile(join(upload, 'sandbox-sw.js'), '// worker');
	const previousRemote = await readFile(join(webRoot, 'remote.html'), 'utf8');
	await writeFile(join(webRoot, 'remote.html'), 'previous remote entry');
	await mkdir(join(webRoot, 'index.html.new'));
	await assert.rejects(install());
	await rm(join(webRoot, 'index.html.new'), { recursive: true });
	assert.equal((await selector(webRoot)).release, first.release);
	assert.equal(
		await readFile(join(webRoot, 'remote.html'), 'utf8'),
		'previous remote entry'
	);
	await writeFile(join(webRoot, 'remote.html'), previousRemote);

	const phpPort = await freePort();
	const router = join(temporary, 'router.php');
	await writeFile(
		router,
		`<?php file_put_contents(${JSON.stringify(calls)}, "request\\n", FILE_APPEND); require ${JSON.stringify(join(webRoot, 'custom-redirects.php'))};`
	);
	php = spawn(phpBinary, ['-S', `127.0.0.1:${phpPort}`, router], {
		stdio: ['ignore', 'ignore', 'pipe'],
	});
	await new Promise((resolve, reject) => {
		php.stderr.once('data', resolve);
		php.once('error', reject);
	});
	const app = express();
	app.use(express.static(webRoot, { dotfiles: 'deny' }));
	app.use((req, res) => {
		const upstream = httpRequest(
			{
				hostname: '127.0.0.1',
				port: phpPort,
				path: req.url,
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
	});
	server = app.listen(0, '127.0.0.1');
	await once(server, 'listening');
	const base = `http://127.0.0.1:${server.address().port}`;
	const request = (path, host = 'app.example', options = {}) =>
		new Promise((resolve, reject) => {
			const url = new URL(base + path);
			const request = httpRequest(
				url,
				{
					method: options.method ?? 'GET',
					headers: { Host: host, ...options.headers },
				},
				(response) => {
					const chunks = [];
					response.on('data', (chunk) => chunks.push(chunk));
					response.on('end', () =>
						resolve(
							new Response(Buffer.concat(chunks), {
								status: response.statusCode,
								headers: response.headers,
							})
						)
					);
				}
			);
			request.on('error', reject);
			request.end();
		});
	for (const host of ['app.example', 'wordpress.example']) {
		assert.equal((await request('/', host)).status, 200);
		assert.equal((await request(`${root}/api.html`, host)).status, 200);
		const full = await request(`${root}/assets/runtime.wasm`, host);
		assert.equal(await full.text(), '0123456789');
		const range = await request(`${root}/assets/runtime.wasm`, host, {
			headers: { Range: 'bytes=4-' },
		});
		assert.equal(range.status, 206);
		assert.equal(range.headers.get('content-range'), 'bytes 4-9/10');
		assert.equal(await range.text(), '456789');
		const head = await request(`${root}/assets/runtime.wasm`, host, {
			method: 'HEAD',
		});
		assert.equal(head.headers.get('content-length'), '10');
		assert.equal(await head.text(), '');
	}
	await assert.rejects(readFile(calls)); // Static requests never entered a PHP worker.
	assert.equal(
		await (await request('/status.php')).text(),
		'native endpoint'
	);
	assert.equal(
		(await request('/status.php', 'wordpress.example')).status,
		404
	);
	const manifest = await request(
		'/dynamic-manifest.json.php?app_name=Static%20release'
	);
	assert.equal((await manifest.json()).short_name, 'Static release');
	const docs = await request('/docs');
	assert.equal(docs.status, 301);
	assert.equal(
		docs.headers.get('location'),
		'https://wordpress.github.io/wordpress-playground/'
	);
	await writeFile(join(upload, 'assets/runtime.wasm'), 'abcdefghij');
	await install();
	const second = await selector(webRoot);
	assert.notEqual(second.release, first.release);
	assert.equal(
		await (await request(`${root}/assets/runtime.wasm`)).text(),
		'0123456789'
	);
	assert.equal(
		await (
			await request(`/releases/${second.release}/assets/runtime.wasm`)
		).text(),
		'abcdefghij'
	);
	assert.equal(
		await (await request('/status.php')).text(),
		'native endpoint'
	);
	await assert.rejects(install({ FAIL_PURGE: '1' }));
	assert.notEqual((await selector(webRoot)).release, second.release);
	assert.equal(
		(await selector(join(backups, second.release))).release,
		first.release
	);
	console.log(
		'Static release HTTP contracts passed: preflight, upload validation, atomic selector, retained releases, both hosts, zero PHP static requests, ranges, HEAD, native endpoints and redirects.'
	);
} finally {
	server?.closeAllConnections();
	server?.close();
	php?.kill();
	await rm(temporary, { recursive: true, force: true });
}

async function freePort() {
	const server = createServer();
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	const port = server.address().port;
	await new Promise((resolve) => server.close(resolve));
	return port;
}

async function selector(directory) {
	const html = await readFile(join(directory, 'index.html'), 'utf8');
	return JSON.parse(
		html.match(
			/<script id="playground-release" type="application\/json">(.*?)<\/script>/s
		)[1]
	);
}
