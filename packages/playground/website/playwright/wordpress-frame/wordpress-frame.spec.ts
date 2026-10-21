import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { createServer } from 'node:http';
import {
	appOrigin as root,
	wordPressOrigin as wpOrigin,
} from '../../bin/wordpress-frame/origins.mjs';

// These checks create saved sites and inspect shared download counters.
test.describe.configure({ mode: 'default' });
test.describe('WordPress origin boundary', { tag: '@storage' }, () => {
	let external: string;
	const embedder = createServer((req, res) => {
		const url = new URL(req.url!, 'http://127.0.0.1');
		res.setHeader('Content-Type', 'text/html');
		const target = url.searchParams.get('target');
		if (!target) {
			res.end('<!doctype html><title>External embedder</title>');
			return;
		}
		// A real HTTP origin exercises third-party embedding and its storage partition.
		res.end(`<!doctype html><title>External embedder</title>
			<iframe id="embed" style="width:100%;height:800px"
				referrerpolicy="${url.searchParams.has('no-referrer') ? 'no-referrer' : 'strict-origin-when-cross-origin'}"></iframe>
			<script type="module">
			const iframe = document.querySelector('iframe');
			const target = ${JSON.stringify(target)};
			const mode = ${JSON.stringify(url.searchParams.get('sdk'))};
			if (mode) {
				const { startPlaygroundWeb, startPlaygroundAPI } = await import(${JSON.stringify(root + '/client/index.js')});
				window.client = await (mode === 'api'
					? startPlaygroundAPI({ iframe, apiUrl: target })
					: startPlaygroundWeb({ iframe, remoteUrl: target,
						blueprint: { preferredVersions: { wp: '6.9', php: '8.3' } } }));
				window.clientReady = true;
			} else {
				iframe.src = target;
			}
			</script>`);
	});

	test.beforeAll(async () => {
		await new Promise<void>((resolve) =>
			embedder.listen(0, '127.0.0.1', resolve)
		);
		const address = embedder.address() as { port: number };
		external = `http://127.0.0.1:${address.port}`;
	});
	test.afterAll(async () => {
		embedder.closeAllConnections();
		await new Promise<void>((resolve, reject) =>
			embedder.close((error) => (error ? reject(error) : resolve()))
		);
	});

	test('normal external iframe embeds keep the SPA and WordPress working', async ({
		page,
	}) => {
		const url = new URL('/', external);
		url.searchParams.set('target', root + '/?wp=6.9&php=8.3&storage=temp');
		await page.goto(url.href);
		const app = await (await page
			.locator('#embed')
			.elementHandle())!.contentFrame();
		const wp = await ready(app!);
		expect(await wp.evaluate(() => window.location.origin)).toBe(wpOrigin);
	});

	test('referrer-free plain embeds work without new URL parameters', async ({
		page,
	}) => {
		const target = new URL('/?wp=6.9&php=8.3&storage=temp', root);
		const url = new URL('/', external);
		url.searchParams.set('target', target.href);
		url.searchParams.set('no-referrer', '1');
		await page.goto(url.href);
		const app = await (await page
			.locator('#embed')
			.elementHandle())!.contentFrame();
		await ready(app!);
	});

	test('nested external embeds work without referrers or origin declarations', async ({
		page,
	}) => {
		const middleOrigin = external.replace('127.0.0.1', 'localhost');
		const target = new URL('/?wp=6.9&php=8.3&storage=temp', root);
		const middle = new URL('/', middleOrigin);
		middle.searchParams.set('target', target.href);
		middle.searchParams.set('no-referrer', '1');
		const outer = new URL('/', external);
		outer.searchParams.set('target', middle.href);
		outer.searchParams.set('no-referrer', '1');
		await page.goto(outer.href);
		const middleFrame = (await (await page
			.locator('#embed')
			.elementHandle())!.contentFrame())!;
		const app = (await (await middleFrame
			.locator('#embed')
			.elementHandle())!.contentFrame())!;
		await ready(app);
	});

	test('referrer-free SDK embeds keep the WordPress and API clients working', async ({
		page,
	}) => {
		for (const sdk of ['web', 'api']) {
			const url = new URL('/', external);
			url.searchParams.set(
				'target',
				root + (sdk === 'web' ? '/remote.html' : '/api.html')
			);
			url.searchParams.set('no-referrer', '1');
			url.searchParams.set('sdk', sdk);
			await page.goto(url.href);
			await page.waitForFunction(() => (window as any).clientReady);
			if (sdk === 'web') {
				await expect(
					page
						.frameLocator('#embed')
						.frameLocator('#wp')
						.locator('body')
				).not.toBeEmpty();
				const element = await page
					.frameLocator('#embed')
					.locator('#wp')
					.elementHandle();
				const wp = (await element!.contentFrame())!;
				await expect
					.poll(() => wp.evaluate(() => window.location.origin))
					.toBe(wpOrigin);
				expect(
					await page.evaluate(() =>
						(window as any).client.fileExists(
							'/wordpress/wp-load.php'
						)
					)
				).toBe(true);
			}
		}
	});

	test('cached app HTML loads in a referrer-free embed without new URL parameters', async ({
		page,
	}) => {
		const url = new URL('/', external);
		url.searchParams.set('target', root + '/?wp=6.9&php=8.3&storage=temp');
		await page.goto(url.href);
		const app = await (await page
			.locator('#embed')
			.elementHandle())!.contentFrame();
		await ready(app!);
		const api = new URL('/api.html', root);
		expect(await probeFramedAPI(page, api.href, 10000)).toBe(true);
		await expect
			.poll(() =>
				app!.evaluate(async () => {
					return Boolean(
						await caches.match(
							new URL('/api.html', window.location.origin).href,
							{ ignoreSearch: true }
						)
					);
				})
			)
			.toBe(true);
		// Use a cache-only URL so this checks replayed HTML without relying on the
		// browser's offline emulation to permit service-worker navigations.
		api.pathname = '/cached-api.html';
		expect((await page.request.get(api.href)).status()).toBe(404);
		await app!.evaluate(async (cachedUrl) => {
			for (const name of await caches.keys()) {
				const cache = await caches.open(name);
				const response = await cache.match(
					new URL('/api.html', window.location.origin).href,
					{ ignoreSearch: true }
				);
				if (response) {
					await cache.put(cachedUrl, response);
					return;
				}
			}
			throw new Error('The real API document was not cached');
		}, api.href);
		// The cached API document must work with the same unchanged no-referrer URL.
		expect(await probeFramedAPI(page, api.href, 10000)).toBe(true);
	});

	test('WordPress cannot read existing parent documents, OPFS or API connections', async ({
		page,
	}) => {
		await page.goto('/?wp=6.9&php=8.3&storage=temp');
		const wp = await ready(page);
		const remote = wp.parentFrame()!;
		expect(new URL(remote.url()).origin).toBe(root);
		const boundaries = await wp.evaluate(async (appOrigin) => {
			const access: Record<string, string> = {};
			// Check both remote.html (parent) and the SPA (top), not just WordPress's own bucket.
			for (const frame of ['parent', 'top'] as const) {
				try {
					void window[frame].document.title;
					access[frame + 'Document'] = 'accessible';
				} catch (error) {
					access[frame + 'Document'] = (error as DOMException).name;
				}
				try {
					await window[frame].navigator.storage.getDirectory();
					access[frame + 'OPFS'] = 'accessible';
				} catch (error) {
					access[frame + 'OPFS'] = (error as DOMException).name;
				}
			}
			window.parent.postMessage(
				{
					type: 'APPLY',
					id: 'child-api-attack',
					path: ['writeFile'],
					argumentList: [
						{
							type: 'RAW',
							value: '/wordpress/child-api-attack.txt',
						},
						{ type: 'RAW', value: 'untrusted child' },
					],
				},
				appOrigin
			);
			// Give the attempted RPC time to run before inspecting its side effect.
			await new Promise((resolve) => setTimeout(resolve, 250));
			return access;
		}, root);
		expect(boundaries).toEqual({
			parentDocument: 'SecurityError',
			parentOPFS: 'SecurityError',
			topDocument: 'SecurityError',
			topOPFS: 'SecurityError',
		});
		expect(
			await page.evaluate(() =>
				(window as any).playgroundSites
					.getClient()
					.fileExists('/wordpress/child-api-attack.txt')
			)
		).toBe(false);
		const scopePath = new URL(await wp.evaluate(() => window.location.href))
			.pathname;
		expect((await page.request.get(root + scopePath)).status()).toBe(404);
		expect(
			await page.evaluate(
				async (url) => (await fetch(url)).status,
				root + scopePath
			)
		).toBe(404);

		const helper = remote
			.childFrames()
			.find((frame) => frame.url().includes('/wordpress-bridge.html'))!;
		await helper.evaluate(async (appOrigin) => {
			const scope = new URL(window.location.href).searchParams.get(
				'scope'
			);
			window.parent.postMessage(
				{
					type: 'wordpress-bridge-request',
					scope,
					requestId: 123456,
					method: 'writeFile',
					args: ['/wordpress/bridge-attack.txt', 'untrusted bridge'],
				},
				appOrigin
			);
			await new Promise((resolve) => setTimeout(resolve, 250));
		}, root);
		expect(
			await page.evaluate(() =>
				(window as any).playgroundSites
					.getClient()
					.fileExists('/wordpress/bridge-attack.txt')
			)
		).toBe(false);
	});

	test('a WordPress cache entry cannot replace another Playground request helper', async ({
		page,
		context,
	}) => {
		await page.goto('/?wp=6.9&php=8.3&storage=temp');
		await poisonHelperCache(await ready(page));

		const other = await context.newPage();
		await other.goto(root + '/?wp=6.9&php=8.3&storage=temp');
		const wp = await ready(other);
		const helper = wp
			.parentFrame()!
			.childFrames()
			.find((frame) => frame.url().includes('/wordpress-bridge.html'))!;
		expect(
			await helper.evaluate(() =>
				Boolean((window as any).cachedHelperExecuted)
			)
		).toBe(false);
		await other.close();
	});

	test('offline startup ignores poisoned WordPress helper cache entries', async ({
		page,
		context,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			'Offline startup uses Chromium, as in deployment.spec.ts.'
		);
		await page.goto('/?wp=6.9&php=8.3&storage=temp');
		await ready(page);
		// Cache documents first fetched before the app service worker took control.
		await page.reload();
		await poisonHelperCache(await ready(page));

		await context.setOffline(true);
		await page.reload();
		const wp = await ready(page);
		const helper = wp
			.parentFrame()!
			.childFrames()
			.find((frame) => frame.url().includes('/wordpress-bridge.html'))!;
		expect(
			await helper.evaluate(() =>
				Boolean((window as any).cachedHelperExecuted)
			)
		).toBe(false);
		await page.evaluate(() =>
			(window as any).playgroundSites
				.getClient()
				.writeFile(
					'/wordpress/offline-transport.txt',
					'offline PHP response'
				)
		);
		expect(
			await wp.evaluate(async () =>
				(await fetch('./offline-transport.txt')).text()
			)
		).toBe('offline PHP response');
	});

	test('WordPress cannot read or change the parent origin OPFS file', async ({
		page,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			'The OPFS fixture requires Chromium, as in the regular storage suite.'
		);
		await page.goto('/?wp=6.9&php=8.3&storage=temp');
		const wp = await ready(page);
		const remote = wp.parentFrame()!;
		const marker = {
			name: `root-private-${crypto.randomUUID()}.txt`,
			contents: 'private parent data',
		};
		await remote.evaluate(async ({ name, contents }) => {
			const directory = await navigator.storage.getDirectory();
			const file = await directory.getFileHandle(name, { create: true });
			const writer = await file.createWritable();
			await writer.write(contents);
			await writer.close();
		}, marker);
		const attempt = await wp.evaluate(async (name) => {
			const directory = await navigator.storage.getDirectory();
			let read;
			try {
				read = await (
					await (await directory.getFileHandle(name)).getFile()
				).text();
			} catch (error) {
				read = (error as DOMException).name;
			}
			// Write and delete the same path in WordPress's own OPFS. Neither may touch the parent.
			const file = await directory.getFileHandle(name, { create: true });
			const writer = await file.createWritable();
			await writer.write('written by WordPress');
			await writer.close();
			const written = await (await file.getFile()).text();
			await directory.removeEntry(name);
			return { read, written };
		}, marker.name);
		expect(attempt).toEqual({
			read: 'NotFoundError',
			written: 'written by WordPress',
		});
		// Read back through both root-origin documents after the attempted read, write and delete.
		for (const frame of [remote, page.mainFrame()]) {
			expect(
				await frame.evaluate(async (name) => {
					const directory = await navigator.storage.getDirectory();
					return (
						await (await directory.getFileHandle(name)).getFile()
					).text();
				}, marker.name)
			).toBe(marker.contents);
		}
	});

	test('WordPress caches cannot replace the thumbnail resource worker', async ({
		page,
	}) => {
		await page.goto('/?wp=6.9&php=8.3&storage=temp');
		const wp = await ready(page);
		let workerUrl: string | undefined;
		page.on('worker', (worker) => {
			if (worker.url().includes('playground-site-thumbnail-worker'))
				workerUrl = worker.url();
		});
		await page.evaluate(() =>
			(window as any).playgroundSites.getClient().captureSiteThumbnail()
		);
		expect(workerUrl).toBeTruthy();
		await page.evaluate(() =>
			(window as any).playgroundSites
				.getClient()
				.writeFile(
					'/wordpress/worker-probe.txt',
					'trusted resource worker'
				)
		);
		await wp.evaluate(async (url) => {
			for (const name of new Set([
				'attacker-cache',
				...(await caches.keys()),
			])) {
				const cache = await caches.open(name);
				await cache.put(
					url,
					new Response(
						'self.onmessage = () => self.postMessage({ result: "poisoned worker" });',
						{
							headers: { 'Content-Type': 'text/javascript' },
						}
					)
				);
			}
		}, workerUrl!);

		const result = await wp.evaluate(
			(url) =>
				new Promise((resolve, reject) => {
					const worker = new Worker(url);
					worker.onmessage = (event) => {
						worker.terminate();
						resolve(event.data.result);
					};
					worker.onerror = (event) => {
						worker.terminate();
						reject(new Error(event.message));
					};
					worker.postMessage({
						url: new URL('./worker-probe.txt', window.location.href)
							.href,
						responseType: 'text',
						timeout: 3000,
					});
				}),
			workerUrl!
		);
		expect(result).toBe('trusted resource worker');
	});

	/** An attacker can write every cache on the shared WordPress origin, including older releases. */
	async function poisonHelperCache(wp: Frame) {
		await wp.evaluate(async () => {
			const url = new URL(
				'/wordpress-bridge.html',
				window.location.origin
			).href;
			const response = await fetch(url, {
				referrerPolicy: 'no-referrer',
			});
			if (!response.ok)
				throw new Error('The real request helper did not load');
			// Keep the real helper working so a timeout cannot mask execution of the injected script.
			const html =
				'<script>window.cachedHelperExecuted = true;</script>' +
				(await response.text());
			const names = new Set(['attacker-cache', ...(await caches.keys())]);
			for (const name of names) {
				const cache = await caches.open(name);
				const keys = (await cache.keys()).filter(
					(key) =>
						new URL(key.url).pathname === '/wordpress-bridge.html'
				);
				for (const key of [url, ...keys]) {
					await cache.put(
						key,
						new Response(html, {
							headers: { 'Content-Type': 'text/html' },
						})
					);
				}
			}
		});
	}

	/** Connect an unchanged API iframe URL from an external page with no referrer. */
	async function probeFramedAPI(
		parent: Page | Frame,
		apiUrl: string,
		timeoutMs: number
	) {
		return await parent.evaluate(
			async ({ apiUrl, timeoutMs, origin }) => {
				const iframe = document.createElement('iframe');
				iframe.hidden = true;
				iframe.referrerPolicy = 'no-referrer';
				iframe.src = apiUrl;
				const id = crypto.randomUUID();
				return await new Promise<boolean>((resolve) => {
					const interval = setInterval(
						() =>
							iframe.contentWindow?.postMessage(
								{
									id,
									type: 'APPLY',
									path: ['isReady'],
									argumentList: [],
								},
								origin
							),
						100
					);
					const timeout = setTimeout(() => finish(false), timeoutMs);
					window.addEventListener('message', onMessage);
					document.body.append(iframe);

					/** Accept only this iframe's successful ready response, not other runtime messages. */
					function onMessage(event: MessageEvent) {
						if (
							event.source === iframe.contentWindow &&
							event.origin === origin &&
							event.data?.id === id &&
							event.data.type === 'RAW'
						)
							finish(true);
					}

					/** Stop probing and remove the listener and temporary iframe on either outcome. */
					function finish(connected: boolean) {
						clearInterval(interval);
						clearTimeout(timeout);
						window.removeEventListener('message', onMessage);
						iframe.remove();
						resolve(connected);
					}
				});
			},
			{ apiUrl, timeoutMs, origin: root }
		);
	}

	/** Wait for the app API and WordPress document, then return the visible frame from its element. */
	async function ready(page: Page | Frame): Promise<Frame> {
		await page.waitForFunction(() =>
			Boolean((window as any).playgroundSites)
		);
		await page.evaluate(() => (window as any).playgroundSites.isReady());
		const iframe = page
			.frameLocator(
				'#playground-viewport:visible,.playground-viewport:visible'
			)
			.locator('#wp');
		await expect(iframe.contentFrame().locator('body')).not.toBeEmpty();
		const element = (await iframe.elementHandle())!;
		const wp = (await element.contentFrame())!;
		await element.dispose();
		// An error page would also block parent access. Require the real WordPress
		// origin and scope so a failed load cannot look like storage protection.
		await expect
			.poll(() =>
				wp.evaluate(() => ({
					origin: window.location.origin,
					pathname: window.location.pathname,
				}))
			)
			.toEqual({
				origin: wpOrigin,
				pathname: expect.stringMatching(/^\/scope:/),
			});
		return wp;
	}
});
