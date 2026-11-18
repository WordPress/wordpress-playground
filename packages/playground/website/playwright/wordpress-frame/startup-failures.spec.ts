import { expect, test as base } from '@playwright/test';
import type { Page } from '@playwright/test';
import express from 'express';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { joinPaths } from '@php-wasm/util';
import {
	appOrigin as previewAppOrigin,
	wordPressOrigin as previewWordPressOrigin,
} from '../../bin/wordpress-frame/origins.mjs';

type Failure =
	| 'none'
	| 'service-worker'
	| 'php-worker'
	| 'bootstrap-module'
	| 'entry-document'
	| 'cache-open'
	| 'cache-read';

interface FailureServer {
	appOrigin: string;
	embedderOrigin: string;
	releaseBase: string;
	failure: Failure;
	entryStatus: number;
	assetStatus: number;
	assetRequests: number;
	blockedRequests: string[];
}

const webRoot = joinPaths(
	__dirname,
	'../../../../../dist/packages/playground/website-preview'
);

const test = base.extend<{ failureServer: FailureServer }>({
	// Playwright requires a destructured argument even for a fixture with no dependencies.
	// eslint-disable-next-line no-empty-pattern
	failureServer: async ({}, use) => {
		const manifest = JSON.parse(
			await readFile(joinPaths(webRoot, 'release.json'), 'utf8')
		);
		const releaseBase = joinPaths('/releases', manifest.release) + '/';
		const remoteHtml = await readFile(
			joinPaths(webRoot, 'remote.html'),
			'utf8'
		);
		const bootstrapPath = remoteHtml.match(
			/<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+)"/
		)?.[1];
		if (!bootstrapPath)
			throw new Error('Built remote.html has no module script');
		const fixture: FailureServer = {
			appOrigin: '',
			embedderOrigin: '',
			releaseBase,
			failure: 'none',
			entryStatus: 200,
			assetStatus: 200,
			assetRequests: 0,
			blockedRequests: [],
		};
		const app = express();
		app.use(async (request, response, next) => {
			response.set('Cache-Control', 'no-store');
			response.set('Access-Control-Allow-Origin', '*');
			const blocked =
				(fixture.failure === 'service-worker' &&
					request.path === '/sw.js') ||
				(fixture.failure === 'php-worker' &&
					request.path.startsWith(releaseBase) &&
					request.path.includes(
						'/playground-worker-endpoint-blueprints-'
					)) ||
				(fixture.failure === 'bootstrap-module' &&
					request.path === bootstrapPath) ||
				(fixture.failure === 'entry-document' &&
					request.path === '/remote.html');
			if (
				blocked ||
				(request.path === '/remote.html' && fixture.entryStatus !== 200)
			) {
				fixture.blockedRequests.push(request.path);
				response
					.status(blocked ? 403 : fixture.entryStatus)
					.type('html')
					.send(
						'<!doctype html><title>Checking your browser...</title><p>Challenge fixture</p>'
					);
				return;
			}
			if (request.path === '/embed.html') {
				// Load the released SDK and real remote page from a different origin.
				// Only HTTP responses and browser cache failures are injected; RPC is real.
				response.type('html').send(`<!doctype html>
<iframe id="playground"></iframe>
<script type="module">
import { startPlaygroundWeb } from ${JSON.stringify(
					fixture.appOrigin + releaseBase + 'client/index.js'
				)};
window.startupResult = { state: 'pending' };
startPlaygroundWeb({
    iframe: document.querySelector('iframe'),
    remoteUrl: ${JSON.stringify(fixture.appOrigin + '/remote.html')},
    connectionTimeoutMs: ${fixture.failure === 'entry-document' ? 3000 : 20000},
    blueprint: { preferredVersions: { php: '8.3', wp: false } },
}).then(
    () => window.startupResult = { state: 'resolved' },
    error => window.startupResult = {
        state: 'rejected', name: error.name, message: error.message
    }
);
</script>`);
				return;
			}
			if (request.path === '/seed.html') {
				response
					.type('html')
					.send('<!doctype html><title>Startup fixture</title>');
				return;
			}
			if (request.path === releaseBase + 'cache-probe.js') {
				fixture.assetRequests++;
				if (fixture.assetStatus !== 200) {
					response
						.status(fixture.assetStatus)
						.type('html')
						.send('Browser challenge');
					return;
				}
				response.type('js').send('export const loaded = true;');
				return;
			}
			if (
				request.path.endsWith('.html') ||
				request.path.endsWith('.js')
			) {
				try {
					let contents = await readFile(
						joinPaths(webRoot, request.path),
						'utf8'
					);
					// Keep the built origin guards and worker policies, configured for this
					// isolated listener rather than the standard preview's fixed port.
					contents = contents
						.replaceAll(
							previewWordPressOrigin,
							fixture.embedderOrigin
						)
						.replaceAll(previewAppOrigin, fixture.appOrigin);
					if (request.path === releaseBase + 'sw.js') {
						if (fixture.failure === 'cache-open') {
							contents = `caches.open = () => Promise.reject(new DOMException('Cache denied', 'SecurityError'));\n${contents}`;
						} else if (fixture.failure === 'cache-read') {
							contents = `Cache.prototype.match = () => Promise.reject(new DOMException('Cache read denied', 'SecurityError'));\n${contents}`;
						}
					}
					response
						.type(request.path.endsWith('.js') ? 'js' : 'html')
						.send(contents);
					return;
				} catch (error) {
					if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
						throw error;
				}
			}
			next();
		});
		app.use(express.static(webRoot));
		const server = createServer(app);
		await new Promise<void>((resolve) =>
			server.listen(0, '127.0.0.1', resolve)
		);
		const port = (server.address() as AddressInfo).port;
		fixture.appOrigin = `http://localhost:${port}`;
		fixture.embedderOrigin = `http://127.0.0.1:${port}`;
		try {
			await use(fixture);
		} finally {
			server.closeAllConnections();
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	},
});

// Contract: a failed installed release rejects the SDK startup promise. Network
// failures can precede API exposure or prevent the bootstrap module from running.
// Exercise the installed HTML, SDK, and workers instead of mocking their methods.
for (const failure of [
	'service-worker',
	'php-worker',
	'bootstrap-module',
	'entry-document',
] as const) {
	test(`an embedded release rejects startup when ${failure} is challenged`, async ({
		page,
		failureServer,
	}) => {
		failureServer.failure = failure;
		await page.goto(failureServer.embedderOrigin + '/embed.html');
		await expect
			.poll(
				() => page.evaluate(() => (window as any).startupResult?.state),
				{ timeout: 15000 }
			)
			.toBe('rejected');
		expect(failureServer.blockedRequests.length).toBeGreaterThan(0);
		const result = await page.evaluate(() => (window as any).startupResult);
		expect(result.message).toBeTruthy();
		if (failure === 'entry-document') {
			expect(result.name).toBe('TimeoutError');
		} else {
			// A running remote reports its cause before the connection timeout.
			expect(result.name).not.toBe('TimeoutError');
			await expect(
				page.frameLocator('#playground').getByLabel('Error details')
			).toHaveValue(
				new RegExp(
					failure === 'bootstrap-module'
						? 'startup script'
						: 'worker',
					'i'
				)
			);
		}
	});
}

// Contract: explicit authorization failures stay visible online. An existing
// offline document must not replace a 401/403 with a successful cached response.
for (const status of [401, 403]) {
	test(`a warm entry cache preserves an online HTTP ${status}`, async ({
		page,
		failureServer,
	}) => {
		await registerAppWorker(page, failureServer);
		await page.evaluate(() => fetch('/remote.html'));
		await expect
			.poll(() =>
				page.evaluate(async () =>
					Boolean(await caches.match('/remote.html'))
				)
			)
			.toBe(true);
		failureServer.entryStatus = status;
		expect(
			await page.evaluate(
				async () => (await fetch('/remote.html')).status
			)
		).toBe(status);
	});
}

test('a warm entry cache still recovers from a transient server failure', async ({
	page,
	failureServer,
}) => {
	await registerAppWorker(page, failureServer);
	await page.evaluate(() => fetch('/remote.html'));
	await expect
		.poll(() =>
			page.evaluate(async () =>
				Boolean(await caches.match('/remote.html'))
			)
		)
		.toBe(true);
	failureServer.entryStatus = 503;
	expect(
		await page.evaluate(async () => (await fetch('/remote.html')).status)
	).toBe(200);
});

// A challenge fetched by the worker must not enter the release's asset cache.
// Otherwise a successful retry could replay HTML as JavaScript indefinitely.
test('a challenged asset fetched by the service worker can retry after clearance', async ({
	page,
	failureServer,
}) => {
	await registerAppWorker(page, failureServer);
	const asset = failureServer.releaseBase + 'cache-probe.js';
	failureServer.assetStatus = 403;
	expect(
		await page.evaluate(async (url) => (await fetch(url)).status, asset)
	).toBe(403);
	expect(
		await page.evaluate(
			async (url) => Boolean(await caches.match(url)),
			asset
		)
	).toBe(false);
	failureServer.assetStatus = 200;
	expect(
		await page.evaluate(async (url) => (await fetch(url)).text(), asset)
	).toBe('export const loaded = true;');
	expect(failureServer.assetRequests).toBe(2);
});

// Contract: offline caching is optional for online platform downloads. A browser
// storage failure must not stop the worker before it tries the independent network.
for (const failure of ['cache-open', 'cache-read'] as const) {
	test(`platform assets load from HTTP after ${failure} fails`, async ({
		page,
		failureServer,
	}) => {
		failureServer.failure = failure;
		await registerAppWorker(page, failureServer);
		const result = await page.evaluate(async (url) => {
			try {
				const response = await fetch(url);
				return { status: response.status, body: await response.text() };
			} catch (error) {
				return { error: String(error) };
			}
		}, failureServer.releaseBase + 'cache-probe.js');
		expect(result).toEqual({
			status: 200,
			body: 'export const loaded = true;',
		});
		expect(failureServer.assetRequests).toBe(1);
	});
}

test('an embedded release can still boot PHP after connecting', async ({
	page,
	failureServer,
}) => {
	await page.goto(failureServer.embedderOrigin + '/embed.html');
	await expect
		.poll(() => page.evaluate(() => (window as any).startupResult), {
			timeout: 60000,
		})
		.toEqual({ state: 'resolved' });
});

async function registerAppWorker(page: Page, fixture: FailureServer) {
	await page.goto(fixture.appOrigin + '/seed.html');
	await page.evaluate(async () => {
		await navigator.serviceWorker.register('/sw.js', {
			type: 'module',
			updateViaCache: 'none',
		});
		await navigator.serviceWorker.ready;
		if (!navigator.serviceWorker.controller) {
			await new Promise<void>((resolve) =>
				navigator.serviceWorker.addEventListener(
					'controllerchange',
					() => resolve(),
					{ once: true }
				)
			);
		}
	});
}
