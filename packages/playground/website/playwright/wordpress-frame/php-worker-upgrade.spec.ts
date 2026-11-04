import { expect, test } from '@playwright/test';
import express from 'express';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { joinPaths } from '@php-wasm/util';

const remoteDirectory = joinPaths(
	__dirname,
	'../../../../../dist/packages/playground/remote'
);
let server: Server;
let appOrigin: string;
let embedderOrigin: string;
let release: 'A' | 'B';
let phpWorkerRequests: string[];

test.beforeAll(async () => {
	const app = express();
	app.use((_request, response, next) => {
		response.setHeader('Cache-Control', 'no-store');
		next();
	});
	app.get('/', (_request, response) => {
		response
			.type('html')
			.send(
				`<!doctype html><iframe src="${appOrigin}/seed.html"></iframe>`
			);
	});
	app.get('/seed.html', (_request, response) => {
		response.type('html').send('<!doctype html><title>Worker seed</title>');
	});
	app.get('/sw.js', (_request, response) => {
		// Model an installed release A and a deployed release B. Both forward
		// downloads to HTTP. Slow B's installation so update() returns before
		// activation, just as it can with the real app worker after deployment.
		response.type('js').send(`
const release = ${JSON.stringify(release)};
self.addEventListener('install', event => event.waitUntil((async () => {
    if (release === 'B') await new Promise(resolve => setTimeout(resolve, 1000));
    await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
    const headers = new Headers(event.request.headers);
    headers.set('X-Test-Worker-Release', release);
    event.respondWith(fetch(new Request(event.request, { headers })));
});`);
	});
	app.get(
		'/playground-worker-endpoint-blueprints-:hash.js',
		async (request, response) => {
			phpWorkerRequests.push(
				request.get('X-Test-Worker-Release') ?? 'uncontrolled'
			);
			const script = await readFile(
				joinPaths(remoteDirectory, request.path)
			);
			// Send headers and part of the real PHP worker script immediately, but
			// leave its download unfinished while B activates. WebKit closes A's
			// handled fetch at that point with "Service Worker context closed".
			response.type('js').write('// PHP worker download in progress\n');
			setTimeout(() => response.end(script), 1500);
		}
	);
	app.use(express.static(remoteDirectory));
	server = createServer(app);
	await new Promise<void>((resolve) =>
		server.listen(0, '127.0.0.1', resolve)
	);
	const port = (server.address() as AddressInfo).port;
	// localhost and 127.0.0.1 are different sites. Keep the same top-level site
	// while seeding A and starting remote.html so WebKit reuses its partition.
	appOrigin = `http://localhost:${port}`;
	embedderOrigin = `http://127.0.0.1:${port}`;
});

test.afterAll(async () => {
	if (server) {
		server.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
});

test('an embed starts PHP after its app service worker finishes updating', async ({
	page,
}) => {
	release = 'A';
	phpWorkerRequests = [];
	const failedRequests: string[] = [];
	page.on('requestfailed', (request) => {
		failedRequests.push(
			`${request.url()}: ${request.failure()?.errorText}`
		);
	});
	await page.goto(embedderOrigin);
	const remote = page
		.frames()
		.find((frame) => frame.url().startsWith(appOrigin))!;
	await remote.evaluate(async () => {
		const registration = await navigator.serviceWorker.register('/sw.js', {
			type: 'module',
			updateViaCache: 'none',
		});
		await navigator.serviceWorker.ready;
		const worker =
			registration.installing ??
			registration.waiting ??
			registration.active!;
		while (worker.state !== 'activated') {
			await new Promise<void>((resolve) =>
				worker.addEventListener('statechange', () => resolve(), {
					once: true,
				})
			);
		}
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
	release = 'B';
	await remote.goto(appOrigin + '/remote.html?progressbar=true');
	// Exercise the built remote.html and PHP module worker, not a copy of their
	// startup code. No client boot() call or Blueprint has run at this point.
	await remote.waitForFunction(
		() =>
			Boolean((window as any).playground) ||
			document.body.classList.contains('has-error')
	);
	expect(
		await remote.locator('body').getAttribute('class'),
		failedRequests.join('\n')
	).not.toContain('has-error');
	expect(
		await remote.evaluate(() => Boolean((window as any).playground))
	).toBe(true);
	// Also lock the ordering in Chromium/Firefox, which can preserve A's
	// in-flight download rather than showing WebKit's failure.
	expect(phpWorkerRequests).toEqual(['B']);
});
