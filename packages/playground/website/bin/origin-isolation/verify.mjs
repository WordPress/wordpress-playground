import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect } from '@playwright/test';

// Run with port 9400 free. Counting responses on the actual server also covers
// worker/SW downloads that page-level network events can miss.
const server = spawn(
	process.execPath,
	[new URL('serve.mjs', import.meta.url).pathname],
	{
		stdio: ['ignore', 'pipe', 'inherit'],
	}
);
const downloads = [];
let pending = '';
const ready = new Promise((resolve, reject) => {
	server.once('exit', (code) =>
		reject(new Error(`Prototype server exited: ${code}`))
	);
	server.stdout.on('data', (chunk) => {
		pending += chunk;
		const lines = pending.split('\n');
		pending = lines.pop();
		for (const line of lines) {
			if (line.startsWith('Origin isolation prototype:')) resolve();
			if (line.startsWith('{')) downloads.push(JSON.parse(line));
		}
	});
});
const profile = await mkdtemp(join(tmpdir(), 'playground-origin-isolation-'));
let browser;
let page;
try {
	await ready;
	// Playwright's default switches disable some partitioning features. Use only
	// transport/headless switches so this exercises Chromium's normal cache rules.
	const context = await chromium.launchPersistentContext(profile, {
		executablePath:
			process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
			chromium.executablePath(),
		ignoreDefaultArgs: true,
		args: [
			'--headless=new',
			'--remote-debugging-pipe',
			'--no-first-run',
			'--disable-extensions',
			'--disable-background-networking',
			'--no-default-browser-check',
			`--user-data-dir=${profile}`,
		],
	});
	browser = context.browser();
	context.setDefaultTimeout(30000);
	page = await context.newPage();
	page.on('pageerror', (error) => console.error(error));
	page.on('response', (response) => {
		if (response.status() >= 400)
			console.error(response.status(), response.url());
	});
	page.on('console', (message) => {
		if (message.type() === 'error') console.error(message.text());
	});
	const start = 'http://playground.localhost:9400/?new=1&wp=6.9&php=8.3';
	await openSite(page, start);
	const alpha = new URL(page.url()).origin;
	assert.equal(
		await page.evaluate(() => window.playgroundSites.list()[0].storage),
		'opfs'
	);
	await page.evaluate(async () => {
		window.shellToken = 'still mounted';
		const client = window.playgroundSites.getClient();
		await client.writeFile('/wordpress/isolation.txt', 'alpha PHP file');
		await client.flushOpfs('/wordpress');
		await window.playgroundSites.saveInBrowser('Alpha');
		await window.playgroundSites.rename('Alpha renamed');
	});
	await page.getByRole('button', { name: 'Dev Tools', exact: true }).click();
	assert.equal(await page.evaluate(() => window.shellToken), 'still mounted');
	assert.equal(new URL(page.url()).origin, alpha);
	const alphaFrame = page
		.frames()
		.find((frame) => new URL(frame.url()).pathname.startsWith('/scope:'));
	assert.ok(alphaFrame, 'WordPress iframe is running');
	await alphaFrame.evaluate(async () => {
		const root = await navigator.storage.getDirectory();
		const file = await root.getFileHandle('alpha-only.txt', {
			create: true,
		});
		const writer = await file.createWritable();
		await writer.write('alpha private data');
		await writer.close();
	});
	await page.waitForLoadState('networkidle');
	const firstDownloads = [...downloads];
	const firstBytes = firstDownloads.reduce(
		(sum, entry) => sum + entry.bytes,
		0
	);

	await openSite(page, start);
	const beta = new URL(page.url()).origin;
	assert.notEqual(beta, alpha);
	assert.equal(
		await page.evaluate(() => window.playgroundSites.list()[0].storage),
		'opfs'
	);
	const betaFrame = page
		.frames()
		.find((frame) => new URL(frame.url()).pathname.startsWith('/scope:'));
	const isolation = await betaFrame.evaluate(async () => {
		const root = await navigator.storage.getDirectory();
		let read, remove;
		try {
			await root.getFileHandle('alpha-only.txt');
			read = 'allowed';
		} catch (error) {
			read = error.name;
		}
		try {
			await root.removeEntry('alpha-only.txt');
			remove = 'allowed';
		} catch (error) {
			remove = error.name;
		}
		const file = await root.getFileHandle('alpha-only.txt', {
			create: true,
		});
		const writer = await file.createWritable();
		await writer.write('beta data at the same path');
		await writer.close();
		return { read, remove, origin: location.origin };
	});
	assert.equal(isolation.origin, beta);
	assert.equal(isolation.read, 'NotFoundError');
	assert.equal(isolation.remove, 'NotFoundError');
	assert.equal(
		await page.evaluate(() =>
			window.playgroundSites
				.getClient()
				.fileExists('/wordpress/isolation.txt')
		),
		false
	);
	const secondDownloads = downloads.slice(firstDownloads.length);
	console.log(
		'Second-site network responses:',
		JSON.stringify(secondDownloads)
	);
	const reusedAssets = firstDownloads.filter(
		(entry) =>
			entry.status === 200 &&
			(entry.bytes > 100000 || entry.asset.endsWith('/sw.js'))
	);
	assert.ok(reusedAssets.some((entry) => entry.asset.endsWith('.wasm')));
	assert.ok(reusedAssets.some((entry) => entry.asset.endsWith('.zst')));
	assert.ok(
		reusedAssets.some((entry) =>
			entry.asset.endsWith('wordpress-static.zip')
		)
	);
	for (const entry of reusedAssets) {
		assert.equal(
			secondDownloads.some(
				(other) => other.asset === entry.asset && other.status === 200
			),
			false,
			`Downloaded again: ${entry.asset}`
		);
	}
	assert.equal(
		secondDownloads.reduce((sum, entry) => sum + entry.bytes, 0),
		0
	);
	assert.ok(
		firstDownloads.some(
			(entry) => entry.asset.endsWith('.wasm') && entry.encoding === 'br'
		),
		'PHP uses the compressed representation'
	);
	assert.equal(
		downloads.some((entry) =>
			entry.asset.includes('assets-required-for-offline-mode')
		),
		false
	);
	assert.equal(
		downloads.some((entry) =>
			/php_(?!8_3)[\d_]+.*\.wasm$/.test(entry.asset)
		),
		false
	);
	assert.equal(
		downloads.some((entry) => /wp-(?!6\.9).*\.zst$/.test(entry.asset)),
		false
	);

	// Reopen a bare site URL, as the launcher does, rather than relying on site-slug.
	await openSite(page, alpha);
	assert.equal(
		await page.evaluate(() =>
			window.playgroundSites
				.getClient()
				.readFileAsText('/wordpress/isolation.txt')
		),
		'alpha PHP file'
	);
	assert.equal(
		await page.evaluate(async () => {
			const root = await navigator.storage.getDirectory();
			return (
				await (await root.getFileHandle('alpha-only.txt')).getFile()
			).text();
		}),
		'alpha private data'
	);
	assert.equal(
		await page.evaluate(() => window.playgroundSites.list()[0].name),
		'Alpha renamed'
	);
	const guard = await page.evaluate(async () => {
		try {
			await window.playgroundSites.createNewSavedSite();
			return 'allowed';
		} catch (error) {
			return error.message;
		}
	});
	assert.match(guard, /One Playground per origin/);

	await openSite(page, `${start}&storage=temp`);
	const temporaryOrigin = new URL(page.url()).origin;
	assert.notEqual(temporaryOrigin, alpha);
	assert.notEqual(temporaryOrigin, beta);
	assert.equal(
		await page.evaluate(() => window.playgroundSites.list()[0].storage),
		'temporary'
	);
	await page.evaluate(async () => {
		window.shellToken = 'temporary shell';
		await window.playgroundSites.saveInBrowser('Saved temporary site');
	});
	assert.equal(new URL(page.url()).origin, temporaryOrigin);
	assert.equal(
		await page.evaluate(() => window.shellToken),
		'temporary shell'
	);
	assert.equal(
		await page.evaluate(() => window.playgroundSites.list()[0].storage),
		'opfs'
	);
	await page
		.getByRole('button', { name: 'New Playground', exact: true })
		.click();
	await page
		.getByRole('button', {
			name: 'Vanilla WordPress - New Playground',
			exact: true,
		})
		.click();
	await page.waitForURL(
		(url) =>
			url.origin !== temporaryOrigin && url.hostname.startsWith('site-'),
		{ waitUntil: 'domcontentloaded' }
	);
	assert.notEqual(new URL(page.url()).origin, temporaryOrigin);
	await page.waitForFunction(() => Boolean(window.playgroundSites));
	await page.evaluate(() => window.playgroundSites.isReady());
	await page.screenshot({ path: 'dist/origin-isolation.png' });

	// No global exporter or remote API exists on the launcher origin.
	for (const path of ['/remote.html', '/api.html']) {
		assert.equal(
			(
				await context.request.get(`http://127.0.0.1:9400${path}`, {
					headers: { host: 'playground.localhost:9400' },
				})
			).status(),
			404
		);
		assert.equal(
			(
				await context.request.get('http://127.0.0.1:9400/api.html', {
					headers: { host: new URL(alpha).host },
				})
			).status(),
			404
		);
	}

	// A private context uses a different, smaller HTTP cache. Keep the browser's
	// partitioning flags unchanged and test it separately from the disk profile.
	const privateContext = await browser.newContext();
	const privatePage = await privateContext.newPage();
	const privateStart = downloads.length;
	await openSite(privatePage, start);
	const privateAlpha = new URL(privatePage.url()).origin;
	const privateFirstDownloads = downloads.slice(privateStart);
	const privateSecondStart = downloads.length;
	await openSite(privatePage, start);
	const privateBeta = new URL(privatePage.url()).origin;
	assert.notEqual(privateAlpha, privateBeta);
	const privateSecondDownloads = downloads.slice(privateSecondStart);
	console.log(
		'Private second-site network responses:',
		JSON.stringify(privateSecondDownloads)
	);
	assert.ok(
		privateFirstDownloads.some((entry) => entry.asset.endsWith('.wasm'))
	);
	assert.equal(
		privateSecondDownloads.some(
			(entry) => entry.asset.endsWith('.wasm') && entry.bytes > 0
		),
		false,
		'Compressed PHP WASM fits the private HTTP cache and is reused'
	);
	for (const siteDownloads of [
		privateFirstDownloads,
		privateSecondDownloads,
	]) {
		assert.ok(
			siteDownloads.filter(
				(entry) =>
					entry.asset.endsWith('wordpress-static.zip') &&
					entry.bytes > 0
			).length <= 1,
			'Overlapping frame loads and API calls must not download the ZIP twice'
		);
	}
	await privateContext.close();

	// Compression must not break PHP's decoded-byte resume offsets. Check the
	// actual server's partial bytes, MIME type, and CORS/cache variant headers.
	const wasm = firstDownloads.find((entry) => entry.asset.endsWith('.wasm'));
	const wasmUrl = `http://127.0.0.1:9400${wasm.asset}`;
	const headers = { host: 'static.playground.localhost:9400' };
	const compressed = await context.request.get(wasmUrl, {
		headers: { ...headers, 'accept-encoding': 'br' },
	});
	assert.equal(compressed.headers()['content-encoding'], 'br');
	assert.equal(compressed.headers()['content-type'], 'application/wasm');
	assert.equal(compressed.headers()['vary'].toLowerCase(), 'accept-encoding');
	assert.equal(compressed.headers()['access-control-allow-origin'], '*');
	assert.match(compressed.headers()['cache-control'], /immutable/);
	const partial = await context.request.get(wasmUrl, {
		headers: {
			...headers,
			'accept-encoding': 'br',
			range: 'bytes=4096-4127',
		},
	});
	assert.equal(partial.status(), 206);
	assert.equal(partial.headers()['content-encoding'], undefined);
	assert.deepEqual(
		await partial.body(),
		(await compressed.body()).subarray(4096, 4128)
	);
	const report = {
		browser: browser.version(),
		alpha,
		beta,
		wordPressOPFSIsolation: isolation,
		savedFileSurvivedReopening: true,
		saveRenameAndPanelsKeptShell: true,
		temporarySaveKeptOriginAndShell: true,
		newPlaygroundUsedFreshOrigin: true,
		firstSiteSharedBytes: firstBytes,
		secondSiteSharedBytes: secondDownloads.reduce(
			(sum, entry) => sum + entry.bytes,
			0
		),
		largeSharedAssetsNotDownloadedAgain: reusedAssets.map(
			(entry) => entry.asset
		),
		compressedRuntimeResumeBytesMatch: true,
		privateBrowsing: {
			alpha: privateAlpha,
			beta: privateBeta,
			firstSiteSharedBytes: privateFirstDownloads.reduce(
				(sum, entry) => sum + entry.bytes,
				0
			),
			secondSiteSharedBytes: privateSecondDownloads.reduce(
				(sum, entry) => sum + entry.bytes,
				0
			),
			secondSiteResponses: privateSecondDownloads,
		},
	};
	await writeFile(
		'dist/origin-isolation-results.json',
		JSON.stringify(report, null, 2)
	);
	console.log(JSON.stringify(report, null, 2));
} catch (error) {
	if (page && !page.isClosed()) {
		console.error('Page URL:', page.url());
		await page
			.screenshot({
				path: 'dist/origin-isolation-failure.png',
				timeout: 5000,
			})
			.catch(() => {});
	}
	throw error;
} finally {
	await browser?.close();
	server.kill();
	await rm(profile, { recursive: true, force: true });
}

async function openSite(page, href) {
	console.log('Opening', href);
	await page.goto(href, { waitUntil: 'domcontentloaded' });
	console.log('Document loaded', page.url());
	await page.waitForFunction(() => Boolean(window.playgroundSites));
	console.log('App loaded');
	await page.evaluate(async () => {
		await window.playgroundSites.isReady();
		await window.playgroundSites
			.getClient()
			.backfillStaticFilesRemovedFromMinifiedBuild();
	});
	await expect
		.poll(
			() =>
				page.evaluate(async () => {
					const site = window.playgroundSites.list()[0];
					if (site.storage === 'temporary') return true;
					const root = await navigator.storage.getDirectory();
					const sites = await root.getDirectoryHandle('sites');
					const dir = await sites.getDirectoryHandle(
						`site-${encodeURIComponent(site.slug)}`
					);
					const file = await dir.getFileHandle('wp-runtime.json');
					return (
						JSON.parse(await (await file.getFile()).text())
							.initialOpfsSyncPending === false
					);
				}),
			{ timeout: 120000 }
		)
		.toBe(true);
	console.log('Ready', page.url());
}
