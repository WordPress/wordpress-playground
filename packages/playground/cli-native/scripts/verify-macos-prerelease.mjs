#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function parseArguments(argv) {
	const values = new Map();
	for (let index = 0; index < argv.length; index += 2) {
		const name = argv[index];
		const value = argv[index + 1];
		if (!name?.startsWith('--') || value === undefined) {
			throw new Error(
				`Expected --name value arguments, received ${name ?? '<end>'}`
			);
		}
		values.set(name.slice(2), value);
	}
	for (const required of ['bundle-dir', 'expected-target', 'source-commit']) {
		if (!values.has(required)) {
			throw new Error(`Missing required --${required} argument`);
		}
	}
	return Object.fromEntries(values);
}

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

async function sha256(path) {
	const hash = createHash('sha256');
	for await (const chunk of createReadStream(path)) hash.update(chunk);
	return hash.digest('hex');
}

async function run(command, args, options = {}) {
	return await new Promise((resolvePromise, reject) => {
		const child = spawn(command, args, {
			cwd: options.cwd,
			env: options.env ?? process.env,
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		let stdout = '';
		let stderr = '';
		child.stdout.on('data', (chunk) => (stdout += chunk));
		child.stderr.on('data', (chunk) => (stderr += chunk));
		child.once('error', reject);
		child.once('close', (code, signal) => {
			if (code === 0 && signal === null) {
				resolvePromise({ stdout, stderr });
				return;
			}
			reject(
				new Error(
					`${command} ${args.join(' ')} failed with ${signal ?? `exit ${code}`}\n${stderr.slice(-8_000)}`
				)
			);
		});
	});
}

async function listen(server) {
	await new Promise((resolvePromise, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			server.off('error', reject);
			resolvePromise();
		});
	});
	const address = server.address();
	assert(
		address && typeof address !== 'string',
		'could not inspect fixture server'
	);
	return `http://127.0.0.1:${address.port}/`;
}

async function close(server) {
	if (!server.listening) return;
	await new Promise((resolvePromise) => server.close(() => resolvePromise()));
}

async function verifyChecksums(bundleDir) {
	const contents = await readFile(join(bundleDir, 'SHA256SUMS'), 'utf8');
	const entries = contents.trim().split('\n');
	assert(entries.length >= 5, 'SHA256SUMS has too few entries');
	for (const line of entries) {
		const match = /^([a-f0-9]{64})  ([a-zA-Z0-9._+-]+)$/.exec(line);
		assert(match, `invalid SHA256SUMS line: ${line}`);
		assert(
			(await sha256(join(bundleDir, match[2]))) === match[1],
			`SHA-256 mismatch for ${match[2]}`
		);
	}
}

async function main() {
	const args = parseArguments(process.argv.slice(2));
	const bundleDir = resolve(args['bundle-dir']);
	const expectedTarget = args['expected-target'];
	const sourceCommit = args['source-commit'];
	assert(
		['darwin-x64', 'darwin-arm64'].includes(expectedTarget),
		'--expected-target must be darwin-x64 or darwin-arm64'
	);
	const detectedTarget = `darwin-${process.arch}`;
	assert(
		process.platform === 'darwin' && detectedTarget === expectedTarget,
		`runner ${process.platform}/${process.arch} does not match ${expectedTarget}`
	);

	await verifyChecksums(bundleDir);
	const [manifest, provenance] = await Promise.all([
		readFile(join(bundleDir, 'native-host-manifest.json'), 'utf8').then(
			JSON.parse
		),
		readFile(join(bundleDir, 'prerelease-provenance.json'), 'utf8').then(
			JSON.parse
		),
	]);
	assert(
		provenance.sourceCommit === sourceCommit,
		'prerelease source commit does not match the workflow head'
	);
	assert(
		JSON.stringify(Object.keys(manifest.targets).sort()) ===
			JSON.stringify(['darwin-arm64', 'darwin-x64']),
		'final manifest must contain exactly both macOS targets'
	);
	const targetAsset = manifest.targets[expectedTarget];
	assert(targetAsset, `final manifest is missing ${expectedTarget}`);
	assert(
		targetAsset.path === `wp-playground-native-${expectedTarget}.gz`,
		'final manifest host path is not a flat GitHub release asset name'
	);
	const packagePath = join(bundleDir, provenance.packageFile);
	assert(
		(await sha256(packagePath)) === provenance.packageSha256,
		'package digest does not match prerelease provenance'
	);

	const temporaryRoot = await mkdtemp(
		join(tmpdir(), 'cli-native-prerelease-')
	);
	const consumerRoot = join(temporaryRoot, 'consumer');
	const siteRoot = join(temporaryRoot, 'site');
	const cacheRoot = join(temporaryRoot, 'cache');
	let hostRequests = 0;
	const fixtureServer = createServer(async (request, response) => {
		try {
			const requestPath = decodeURIComponent(
				new URL(request.url ?? '/', 'http://fixture').pathname
			).slice(1);
			if (requestPath !== targetAsset.path) {
				response.writeHead(404).end();
				return;
			}
			const bytes = await readFile(join(bundleDir, requestPath));
			hostRequests++;
			response.writeHead(200, {
				'content-type': 'application/gzip',
				'content-length': bytes.length,
			});
			response.end(bytes);
		} catch {
			response.writeHead(404).end();
		}
	});

	try {
		await Promise.all([
			mkdir(consumerRoot, { recursive: true }),
			mkdir(siteRoot, { recursive: true }),
		]);
		await Promise.all([
			writeFile(
				join(consumerRoot, 'package.json'),
				'{"name":"cli-native-prerelease-verification","private":true,"type":"module"}\n'
			),
			writeFile(
				join(siteRoot, 'index.php'),
				'<?php echo "native-prerelease-ok:" . PHP_VERSION;'
			),
		]);
		const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
		await run(
			npm,
			[
				'install',
				'--ignore-scripts',
				'--no-audit',
				'--no-fund',
				'--no-package-lock',
				packagePath,
			],
			{ cwd: consumerRoot }
		);
		const installedPackage = join(
			consumerRoot,
			'node_modules/@wp-playground/cli-native'
		);
		assert(
			(await readFile(
				join(installedPackage, 'native-host-manifest.json'),
				'utf8'
			)) === `${JSON.stringify(manifest, null, '\t')}\n`,
			'installed package manifest differs from the release manifest'
		);

		const baseUrl = await listen(fixtureServer);
		process.env['WP_PLAYGROUND_NATIVE_HOST_BASE_URL'] = baseUrl;
		process.env['WP_PLAYGROUND_NATIVE_CACHE_DIR'] = cacheRoot;
		const { runCLI } = await import(
			pathToFileURL(join(installedPackage, 'index.js')).href
		);
		const running = await runCLI({
			command: 'server',
			php: '8.2',
			port: 0,
			workers: 2,
			verbosity: 'quiet',
			login: false,
			mount: [{ hostPath: siteRoot, vfsPath: '/wordpress' }],
			wordpressInstallMode: 'do-not-attempt-installing',
			skipSqliteSetup: true,
		});
		try {
			const response = await fetch(running.serverUrl);
			const responseText = await response.text();
			assert(
				response.ok &&
					responseText.startsWith('native-prerelease-ok:8.2.'),
				`PHP 8.2 HTTP smoke failed: ${response.status} ${responseText}`
			);
			const cli = await running.playground.cli([
				'php',
				'-r',
				'echo PHP_VERSION;',
			]);
			assert(
				(await cli.exitCode) === 0 &&
					(await cli.stdoutText).startsWith('8.2.'),
				'PHP 8.2 CLI smoke failed'
			);
		} finally {
			await running[Symbol.asyncDispose]();
		}
		assert(
			hostRequests === 1,
			`expected one host download, received ${hostRequests}`
		);
	} finally {
		delete process.env['WP_PLAYGROUND_NATIVE_HOST_BASE_URL'];
		delete process.env['WP_PLAYGROUND_NATIVE_CACHE_DIR'];
		await close(fixtureServer);
		await rm(temporaryRoot, { recursive: true, force: true });
	}

	process.stdout.write(
		`Verified ${basename(packagePath)} with PHP 8.2 on ${expectedTarget}.\n`
	);
}

main().catch((error) => {
	process.stderr.write(`${error.stack ?? error.message}\n`);
	process.exitCode = 1;
});
