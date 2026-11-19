import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { joinPaths } from '@php-wasm/util';
import { appOrigin as previewAppOrigin } from '../../bin/wordpress-frame/origins.mjs';

const webRoot = joinPaths(
	__dirname,
	'../../../../../dist/packages/playground/website-preview'
);

for (const assetBase of ['/releases/next-release/', '/assets/']) {
	test(`${assetBase} can finish loading while the app worker is replaced`, async ({
		page,
	}) => {
		// Use the built worker: a missing bypass must reproduce WebKit's interrupted
		// module download, rather than testing a fixture's copy of the fetch handler.
		const manifest = JSON.parse(
			await readFile(joinPaths(webRoot, 'release.json'), 'utf8')
		);
		const releaseA = joinPaths('/releases', manifest.release) + '/';
		const releaseB = '/releases/next-release/';
		const worker = await readFile(
			joinPaths(webRoot, releaseA, 'sw.js'),
			'utf8'
		);
		let activeRelease = releaseA;
		let slowResponse: ServerResponse | undefined;
		let bodyFinished = false;
		let bodyTimer: ReturnType<typeof setTimeout> | undefined;
		const failedRequests: string[] = [];
		page.on('requestfailed', (request) => {
			failedRequests.push(
				`${request.url()}: ${request.failure()?.errorText}`
			);
		});
		const server = createServer((request, response) => {
			response.setHeader('Cache-Control', 'no-store');
			if (request.url === '/') {
				response.setHeader('Content-Type', 'text/html');
				response.end(
					'<!doctype html><title>App worker upgrade</title>'
				);
			} else if (request.url === '/sw.js') {
				response.setHeader('Content-Type', 'text/javascript');
				response.end(
					worker
						.replaceAll(previewAppOrigin, origin)
						.replaceAll(releaseA, activeRelease)
				);
			} else if (request.url === releaseA + 'cached.js') {
				response.setHeader('Content-Type', 'text/javascript');
				response.end('export const value = 1;');
			} else if (request.url === assetBase + 'main.js') {
				response.setHeader('Content-Type', 'text/javascript');
				response.end("export { value } from './slow.js';");
			} else if (request.url === assetBase + 'slow.js') {
				response.setHeader('Content-Type', 'text/javascript');
				response.write('// Module download in progress\n');
				slowResponse = response;
			} else {
				response.writeHead(404).end();
			}
		});
		await new Promise<void>((resolve) =>
			server.listen(0, '127.0.0.1', resolve)
		);
		const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
		try {
			await page.goto(origin);
			await page.evaluate(async () => {
				const registration = await navigator.serviceWorker.register(
					'/sw.js',
					{
						type: 'module',
						updateViaCache: 'none',
					}
				);
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
				while (registration.active?.state !== 'activated') {
					await new Promise((resolve) => setTimeout(resolve, 10));
				}
			});

			// Own-release assets must still use the offline cache. Bypassing all
			// release URLs would avoid the interruption but break offline startup.
			await page.evaluate((url) => fetch(url), releaseA + 'cached.js');
			await expect
				.poll(() =>
					page.evaluate(
						async (url) => Boolean(await caches.match(url)),
						releaseA + 'cached.js'
					)
				)
				.toBe(true);

			const download = page.evaluate(async (url) => {
				try {
					return { value: (await import(url)).value };
				} catch (error) {
					return { error: String(error) };
				}
			}, assetBase + 'main.js');
			await expect.poll(() => Boolean(slowResponse)).toBe(true);
			activeRelease = releaseB;
			// Bound the response in case a regression makes a browser wait for the
			// old worker's download before activating its replacement.
			bodyTimer = setTimeout(() => {
				bodyFinished = true;
				slowResponse!.end('export const value = 42;');
			}, 30000);
			await page.evaluate(async () => {
				const changed = new Promise<void>((resolve) =>
					navigator.serviceWorker.addEventListener(
						'controllerchange',
						() => resolve(),
						{ once: true }
					)
				);
				await (await navigator.serviceWorker.getRegistration(
					'/'
				))!.update();
				await changed;
			});
			// A direct HTTP download allows activation before its body finishes in
			// every browser, including ones that preserve a worker-handled response.
			expect(bodyFinished).toBe(false);
			clearTimeout(bodyTimer);
			slowResponse!.end('export const value = 42;');
			expect(await download, failedRequests.join('\n')).toEqual({
				value: 42,
			});
			expect(failedRequests).toEqual([]);
		} finally {
			clearTimeout(bodyTimer);
			slowResponse?.end();
			server.closeAllConnections();
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	});
}
