import { expect, test } from '@playwright/test';
import { rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
	appOrigin,
	wordPressOrigin,
} from '../../bin/wordpress-frame/origins.mjs';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { getWordPressBridgePath } from '../../../remote/src/lib/wordpress-bridge-path';

const sandbox = resolve(
	__dirname,
	'../../../../../dist/packages/playground/remote/wordpress-sandbox'
);
const previousWorker = '__previous-wordpress-worker.js';
const seedDocument = '__previous-wordpress-worker.html';
const previousHelper = getWordPressBridgePath('0'.repeat(40));
const expiredScript = appOrigin + '/assets/wordpress-bridge-expired.js';

test.describe('WordPress helper upgrades', { tag: '@storage' }, () => {
	test.beforeAll(async () => {
		// Seed a real older worker in the browser, not CacheStorage. It synthesizes
		// both legacy and previous-build HTML pointing at a script that is gone.
		await writeFile(
			resolve(sandbox, previousWorker),
			`
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
    const path = new URL(event.request.url).pathname;
    if (path === '/wordpress-bridge.html' || path === ${JSON.stringify(previousHelper)}) {
        event.respondWith(new Response(${JSON.stringify(`<!doctype html><script type="module" src="${expiredScript}"></script>`)}, {
            headers: { 'Content-Type': 'text/html' }
        }));
    }
});`
		);
		await writeFile(
			resolve(sandbox, seedDocument),
			`<!doctype html><script type="module">
await navigator.serviceWorker.register('/${previousWorker}', { scope: '/', type: 'module' });
await navigator.serviceWorker.ready;
parent.postMessage('previous-worker-ready', ${JSON.stringify(appOrigin)});
</script>`
		);
	});

	test.afterAll(async () => {
		await rm(resolve(sandbox, previousWorker), { force: true });
		await rm(resolve(sandbox, seedDocument), { force: true });
	});

	test('a new app boots when the previous worker references a removed helper script', async ({
		page,
		context,
	}) => {
		// Seed below the app origin so browsers use the same service-worker
		// partition as the real nested WordPress frame, including in WebKit.
		const seedUrl = appOrigin + '/__worker-upgrade-probe';
		await context.route(seedUrl, (route) =>
			route.fulfill({
				contentType: 'text/html',
				body: `<!doctype html><script>
addEventListener('message', event => {
    if (event.origin === ${JSON.stringify(wordPressOrigin)} && event.data === 'previous-worker-ready') window.seedReady = true;
});
</script><iframe src="${wordPressOrigin}/${seedDocument}"></iframe>`,
			})
		);
		await page.goto(seedUrl);
		await page.waitForFunction(() => (window as any).seedReady);
		const seed = page
			.frames()
			.find((frame) => frame.url().endsWith(seedDocument))!;
		await seed.waitForFunction(() =>
			Boolean(navigator.serviceWorker.controller)
		);
		for (const path of ['/wordpress-bridge.html', previousHelper]) {
			expect(
				await seed.evaluate(
					async (path) => (await fetch(path)).text(),
					path
				)
			).toContain(expiredScript);
		}
		await context.unroute(seedUrl);
		let expiredRequests = 0;
		page.on('request', (request) => {
			if (request.url() === expiredScript) expiredRequests++;
		});

		await page.goto(appOrigin + '/?wp=6.9&php=8.3&storage=temp');
		await page.waitForFunction(() =>
			Boolean((window as any).playgroundSites)
		);
		await page.evaluate(() => (window as any).playgroundSites.isReady());
		await page.evaluate(() =>
			(window as any).playgroundSites
				.getClient()
				.writeFile(
					'/wordpress/helper-upgrade.txt',
					'current PHP connection'
				)
		);
		const wordpress = page
			.frameLocator(
				'#playground-viewport:visible,.playground-viewport:visible'
			)
			.frameLocator('#wp');
		await expect(wordpress.locator('body')).not.toBeEmpty();
		const element = await page
			.frameLocator(
				'#playground-viewport:visible,.playground-viewport:visible'
			)
			.locator('#wp')
			.elementHandle();
		const frame = (await element!.contentFrame())!;
		await element!.dispose();
		await expect
			.poll(() =>
				frame.evaluate(async () =>
					(await fetch('helper-upgrade.txt')).text()
				)
			)
			.toBe('current PHP connection');
		expect(expiredRequests).toBe(0);

		// This replacement must also leave a future build's helper to the server,
		// rather than recreating the same stale-HTML failure at the next deploy.
		const future = new URL(
			getWordPressBridgePath('f'.repeat(40)),
			wordPressOrigin
		).href;
		const response = page.waitForResponse(future);
		await frame.evaluate(async (url) => {
			await fetch(url, { referrerPolicy: 'no-referrer' });
		}, future);
		expect((await response).fromServiceWorker()).toBe(false);
	});
});
