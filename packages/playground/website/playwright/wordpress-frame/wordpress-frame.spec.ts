/**
 * Exercise the two-host setup through real WordPress pages, not isolated mocks.
 *
 * A working origin split must still boot WordPress, save posts, mount app-origin
 * directory handles, and reuse shared downloads while the SPA stays loaded. These
 * tests also try direct parent/API access and replace WordPress-side cache entries.
 * A failed or empty WordPress document is not a successful security check; ready()
 * requires the real site's scoped URL and body before those assertions run.
 */
import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { getURLScope, setURLScope } from '@php-wasm/scopes';
import { createServer } from 'node:http';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { isWordPressBridgePath } from '../../../remote/src/lib/wordpress-bridge-path';
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

	test('referrer-free embeds work without embedder declarations', async ({
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

	test('cached app HTML uses the sandbox in a referrer-free embed', async ({
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
			.find((frame) =>
				isWordPressBridgePath(new URL(frame.url()).pathname)
			)!;
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
			.find((frame) =>
				isWordPressBridgePath(new URL(frame.url()).pathname)
			)!;
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
			.find((frame) =>
				isWordPressBridgePath(new URL(frame.url()).pathname)
			)!;
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

	test('app relay messages reach WordPress and return across the origin boundary', async ({
		page,
	}) => {
		await page.goto('/?wp=6.9&php=8.3&storage=temp');
		const wp = await ready(page);
		await wp.evaluate((appOrigin) => {
			window.addEventListener('message', (event) => {
				if (
					event.source === window.parent &&
					event.origin === appOrigin &&
					event.data?.type === 'relay' &&
					event.data?.relayType === 'round-trip-probe'
				) {
					window.parent.postMessage(
						{ type: 'relay', relayType: 'round-trip-result' },
						appOrigin
					);
				}
			});
		}, root);
		const relayed = await page
			.locator(
				'#playground-viewport:visible,.playground-viewport:visible'
			)
			.evaluate(async (remote: HTMLIFrameElement) => {
				return await new Promise<boolean>((resolve) => {
					const timeout = setTimeout(() => finish(false), 3000);
					window.addEventListener('message', onMessage);
					remote.contentWindow!.postMessage(
						{ type: 'relay', relayType: 'round-trip-probe' },
						window.location.origin
					);

					/** Accept the reply through remote.html, not a message from an unrelated window. */
					function onMessage(event: MessageEvent) {
						if (
							event.source === remote.contentWindow &&
							event.origin === window.location.origin &&
							event.data?.type === 'relay' &&
							event.data?.relayType === 'round-trip-result'
						)
							finish(true);
					}

					/** Remove this probe's listener and timer on success or timeout. */
					function finish(result: boolean) {
						clearTimeout(timeout);
						window.removeEventListener('message', onMessage);
						resolve(result);
					}
				});
			});
		expect(relayed).toBe(true);
	});

	test('the current URL follows WordPress links and history changes', async ({
		page,
	}) => {
		await page.goto('/?wp=6.9&php=8.3&storage=temp');
		await ready(page);
		await page.evaluate(() =>
			(window as any).playgroundSites.getClient().goTo('/wp-admin/')
		);
		const wp = await ready(page);
		await wp.locator('#menu-pages > a').click();
		await expect
			.poll(() =>
				page.evaluate(() =>
					(window as any).playgroundSites.getClient().getCurrentURL()
				)
			)
			.toBe('/wp-admin/edit.php?post_type=page');
		await wp.evaluate(() =>
			window.history.pushState(
				null,
				'',
				'?post_type=page&paged=2#history'
			)
		);
		await expect
			.poll(() =>
				page.evaluate(() =>
					(window as any).playgroundSites.getClient().getCurrentURL()
				)
			)
			.toBe('/wp-admin/edit.php?post_type=page&paged=2#history');
		// A document without the MU plugin must not retain the previous page's report.
		await page.evaluate(async () => {
			const client = (window as any).playgroundSites.getClient();
			await client.writeFile(
				'/wordpress/no-url-report.html',
				'Static page'
			);
			await client.goTo('/no-url-report.html');
		});
		expect(
			await page.evaluate(() =>
				(window as any).playgroundSites.getClient().getCurrentURL()
			)
		).toBe('/no-url-report.html');
	});

	test('the HTTP bridge preserves short and large response bodies', async ({
		page,
	}) => {
		await page.goto('/?wp=6.9&php=8.3&storage=temp');
		const wp = await ready(page);
		for (const body of [
			'short response',
			'chunk '.repeat(32768) + 'end of response',
		]) {
			await page.evaluate(async (body) => {
				await (window as any).playgroundSites
					.getClient()
					.writeFile('/wordpress/stream-probe.txt', body);
			}, body);
			expect(
				await wp.evaluate(async () =>
					(await fetch('./stream-probe.txt')).text()
				)
			).toBe(body);
		}
	});

	test('each tab serves its own site without exposing requests to other tabs', async ({
		page,
		context,
		browserName,
	}) => {
		await page.goto('/?wp=6.9&php=8.3&storage=temp');
		const wp = await ready(page);
		const other = await context.newPage();
		await other.goto(root + '/?wp=6.9&php=8.3&storage=temp');
		const otherWp = await ready(other);
		// Both sites share the WordPress worker. Record everything it sends this page.
		await otherWp.evaluate(() => {
			const messages: string[] = ((window as any).workerMessages = []);
			navigator.serviceWorker.addEventListener('message', (event) =>
				messages.push(JSON.stringify(event.data))
			);
			navigator.serviceWorker.startMessages();
		});
		for (const [tab, body] of [
			[page, 'first site'],
			[other, 'second site'],
		] as const) {
			await tab.evaluate(
				(body) =>
					(window as any).playgroundSites
						.getClient()
						.writeFile('/wordpress/site-probe.txt', body),
				body
			);
		}
		const readProbes = async () => [
			await wp.evaluate(async () =>
				(await fetch('./site-probe.txt')).text()
			),
			await otherWp.evaluate(async () =>
				(await fetch('./site-probe.txt')).text()
			),
		];
		expect(await readProbes()).toEqual(['first site', 'second site']);

		if (browserName === 'chromium') {
			// Browsers stop idle workers. The new worker must reconnect each site.
			const cdp = await context.newCDPSession(page);
			await cdp.send('ServiceWorker.enable');
			await cdp.send('ServiceWorker.stopAllWorkers');
			expect(await readProbes()).toEqual(['first site', 'second site']);
		}

		const firstScope = new URL(
			await wp.evaluate(() => window.location.href)
		).pathname;
		const received: string[] = await otherWp.evaluate(
			() => (window as any).workerMessages
		);
		expect(received.join('\n')).not.toContain(firstScope);
		await other.close();
	});

	test('WordPress can fetch and navigate to a static file from the shared asset origin', async ({
		page,
	}) => {
		await page.goto('/?wp=6.9&php=8.3&storage=temp');
		const wp = await ready(page);
		const path = '/wp-includes/js/jquery/jquery.min.js';
		// Let the background ZIP finish so it cannot restore the file after removal.
		await expect
			.poll(() =>
				page.evaluate(() =>
					(window as any).playgroundSites
						.getClient()
						.readFileAsText(
							'/wordpress/wordpress-remote-asset-paths'
						)
				)
			)
			.toBe('');
		await page.evaluate(
			(path) =>
				(window as any).playgroundSites
					.getClient()
					.unlink('/wordpress' + path),
			path
		);
		// This must exercise the remote backfill, not a copy already in PHP's filesystem.
		expect(
			await page.evaluate(
				(path) =>
					(window as any).playgroundSites
						.getClient()
						.fileExists('/wordpress' + path),
				path
			)
		).toBe(false);
		const target = new URL(await wp.evaluate(() => window.location.href));
		target.pathname += path.substring(1);
		expect(
			await wp.evaluate(async (url) => {
				const response = await fetch(url, { mode: 'same-origin' });
				return response.text();
			}, target.href)
		).toContain('jQuery');
		// Firefox can render this plain-text document without completing Playwright's goto().
		// Check the navigation response and its full body instead of waiting for that event.
		const navigation = page.waitForResponse(
			(response) =>
				response.url() === target.href &&
				response.frame() === wp &&
				response.request().isNavigationRequest()
		);
		await wp
			.parentFrame()!
			.locator('#wp')
			.evaluate((iframe, url) => {
				(iframe as HTMLIFrameElement).src = url;
			}, target.href);
		const response = await navigation;
		expect(response.status()).toBe(200);
		expect(await response.text()).toContain('jQuery');
		expect(new URL(response.url()).origin).toBe(wpOrigin);
	});

	// Native new-tab navigation must reach the same PHP runtime without exposing app storage.
	// A top-level navigation may miss Safari's partitioned worker; the app worker
	// must also allow its scoped alias through to the trusted wrapper.
	test('scoped navigation falls back to the app wrapper', async ({
		page,
		browser,
		browserName,
	}) => {
		await page.goto('/?wp=6.9&php=8.3&storage=temp');
		const wp = await ready(page);
		const destination = setURLScope(
			new URL('/wp-admin/themes.php', wpOrigin),
			getURLScope(new URL(await wp.evaluate(() => window.location.href)))
		);
		destination.search = '?preview_nonce=a%2Bb';
		destination.hash = '#preview';
		// Force the server path independently of whether this browser can select
		// the existing sandbox registration for a top-level navigation.
		const response = await page.request.get(destination.href, {
			headers: { 'Sec-Fetch-Dest': 'document' },
			maxRedirects: 0,
		});
		expect(response.status()).toBe(302);
		const alias = new URL(response.headers().location);
		alias.hash = destination.hash;
		expect(alias.origin).toBe(root);
		const tab = await page.context().newPage();
		await tab.goto(alias.href);
		const content = tab.frameLocator('#wp');
		await expect(
			content.getByRole('heading', { name: /^Themes\b/ })
		).toBeVisible();
		expect(
			await content.locator('body').evaluate(() => window.location.href)
		).toBe(destination.href);
		expect(
			await content.locator('body').evaluate(() => {
				try {
					void window.parent.document;
					return 'accessible';
				} catch (error) {
					return (error as DOMException).name;
				}
			})
		).toBe('SecurityError');
		await tab.reload();
		await expect(
			content.getByRole('heading', { name: /^Themes\b/ })
		).toBeVisible();
		// The controlled app worker must reject POST, rather than fetching a GET
		// wrapper that silently drops the submitted form body. Server-only probes
		// cannot catch this independent service-worker routing path.
		const postTarget = new URL(alias);
		postTarget.hash = '';
		const posted = tab.waitForResponse(
			(response) =>
				response.url() === postTarget.href &&
				response.request().method() === 'POST'
		);
		await tab.evaluate((action) => {
			const form = document.createElement('form');
			form.method = 'POST';
			form.action = action;
			const input = document.createElement('input');
			input.name = 'preview_content';
			input.value = 'This submission must not become a GET preview';
			form.append(input);
			document.body.append(form);
			form.submit();
		}, postTarget.href);
		const rejected = await posted;
		expect(rejected.fromServiceWorker()).toBe(true);
		expect(rejected.status()).toBe(404);
		await tab.close();
		await wp.evaluate((href) => {
			const link = document.createElement('a');
			link.href = href;
			link.textContent = 'Open themes in another tab';
			link.id = 'native-navigation-probe';
			document.body.prepend(link);
		}, destination.href);
		const opened = page.context().waitForEvent('page');
		await wp
			.locator('#native-navigation-probe')
			.click({ button: 'middle' });
		const nativeTab = await opened;
		if (browserName === 'webkit') {
			// This must be a real browser navigation, not the API-request probe above.
			const expected = new URL(destination);
			const app = new URL(root);
			expected.protocol = app.protocol;
			expected.host = app.host;
			await expect(nativeTab).toHaveURL(expected.href);
		}
		await expect
			.poll(async () => {
				for (const frame of nativeTab.frames()) {
					if (
						frame.url() === destination.href &&
						(await frame
							.getByRole('heading', {
								name: /^Themes\b/,
							})
							.isVisible())
					) {
						return true;
					}
				}
				return false;
			})
			.toBe(true);
		await nativeTab.close();
		// Classic previews submit POST forms, which can open directly only when the
		// browser can select the sandbox worker without the app-origin wrapper.
		if (browserName !== 'webkit') {
			await classicPreviewReuse(page);
		}
		const freshContext = await browser.newContext();
		const missing = await freshContext.newPage();
		await missing.goto(root + '/scope:unavailable/wp-admin/');
		await expect(missing.frameLocator('#wp').locator('body')).toContainText(
			'could not connect to the Playground site'
		);
		await freshContext.close();
	});

	test('WordPress popups use the running site without app storage access', async ({
		page,
	}) => {
		await page.goto('/?wp=6.9&php=8.3&storage=temp');
		await ready(page);
		const path = await page.evaluate(async () => {
			const client = (window as any).playgroundSites.getClient();
			await client.writeFile(
				'/wordpress/popup-probe.php',
				'<?php echo "popup PHP works";'
			);
			return (
				new URL(await client.absoluteUrl).pathname + '/popup-probe.php'
			);
		});
		const opened = page.waitForEvent('popup');
		await page.evaluate(
			(url) => window.open(url, '_blank', 'noopener,noreferrer'),
			root + '/wordpress-popup.html#' + path
		);
		const popup = await opened;
		const content = popup.frameLocator('#wp');
		await expect(content.locator('body')).toHaveText('popup PHP works');
		expect(
			await content.locator('body').evaluate(() => {
				try {
					void window.parent.navigator.storage;
					return 'accessible';
				} catch (error) {
					return (error as DOMException).name;
				}
			})
		).toBe('SecurityError');
		await popup.close();
		// Changing only the first popup's hash would not rerun its URL check.
		// Start a fresh document at about:blank so the error listener is ready
		// before navigation executes the popup module with the rejected URL.
		const rejectedOpen = page.waitForEvent('popup');
		await page.evaluate(() =>
			window.open('about:blank', '_blank', 'noopener,noreferrer')
		);
		const rejected = await rejectedOpen;
		const rejection = rejected.waitForEvent('pageerror');
		await rejected.goto(
			root + '/wordpress-popup.html#' + root + '/api.html'
		);
		expect((await rejection).message).toContain(
			'The popup URL must name a scoped WordPress page.'
		);
		await expect(rejected.locator('#wp')).not.toHaveAttribute('src');
		await rejected.close();
	});

	test('site switching keeps the SPA and reuses the PHP and WordPress downloads', async ({
		page,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			'Saved-site checks require OPFS, as in the regular storage suite.'
		);
		await page.goto('/?wp=6.9&php=8.3&storage=temp');
		await ready(page);
		await page.evaluate(() => ((window as any).appDocument = 'kept'));
		const alpha = await page.evaluate(async () => {
			const api = (window as any).playgroundSites;
			await api
				.getClient()
				.writeFile('/wordpress/alpha.txt', 'alpha files');
			const site = await api.saveInBrowser('Alpha');
			return site;
		});
		await ready(page);
		await page.evaluate(async () => {
			const api = (window as any).playgroundSites;
			await api.getClient().flushOpfs('/wordpress');
			await api.rename('Alpha renamed');
			await api.getClient().backfillStaticFilesRemovedFromMinifiedBuild();
		});
		const firstAssets = await (
			await page.request.get('/__wordpress-frame-assets')
		).json();
		await page.evaluate(() =>
			(window as any).playgroundSites.createNewTemporarySite('Beta', {
				phpVersion: '8.3',
				wpVersion: '6.9',
			})
		);
		await ready(page);
		await page.evaluate(() =>
			(window as any).playgroundSites
				.getClient()
				.backfillStaticFilesRemovedFromMinifiedBuild()
		);
		const laterAssets = (
			await (await page.request.get('/__wordpress-frame-assets')).json()
		).slice(firstAssets.length);
		const largeAssetPaths = firstAssets
			.filter((asset: { path: string }) =>
				/\.(wasm|zip|zst)$/.test(asset.path)
			)
			.map((asset: { path: string }) => asset.path);
		expect(
			largeAssetPaths.some((path: string) => path.endsWith('.wasm'))
		).toBe(true);
		expect(
			largeAssetPaths.some((path: string) =>
				path.endsWith('/wordpress-static.zip')
			)
		).toBe(true);
		expect(
			laterAssets
				.filter((asset: { path: string }) =>
					largeAssetPaths.includes(asset.path)
				)
				.reduce(
					(bytes: number, asset: { bytes: number }) =>
						bytes + asset.bytes,
					0
				)
		).toBe(0);
		expect(
			await page.evaluate(() =>
				(window as any).playgroundSites
					.getClient()
					.fileExists('/wordpress/alpha.txt')
			)
		).toBe(false);
		await page.evaluate(
			(slug) => (window as any).playgroundSites.setActiveSite(slug),
			alpha.slug
		);
		await ready(page);
		expect(
			await page.evaluate(() =>
				(window as any).playgroundSites
					.getClient()
					.readFileAsText('/wordpress/alpha.txt')
			)
		).toBe('alpha files');
		expect(await page.evaluate(() => (window as any).appDocument)).toBe(
			'kept'
		);
		expect(new URL(page.url()).origin).toBe(root);
	});

	test('the block editor can save a post through the cross-origin HTTP transport', async ({
		page,
	}) => {
		await page.goto('/?wp=6.9&php=8.3&storage=temp');
		await ready(page);
		await page.evaluate(() =>
			(window as any).playgroundSites
				.getClient()
				.goTo('/wp-admin/post-new.php')
		);
		const wp = page
			.frameLocator(
				'#playground-viewport:visible,.playground-viewport:visible'
			)
			.frameLocator('#wp');
		await wp
			.getByRole('dialog', { name: 'Welcome to the editor' })
			.getByRole('button', { name: 'Close', exact: true })
			.click();
		await expect(
			wp.getByRole('button', { name: 'Publish', exact: true })
		).toBeVisible();
		const editor = await ready(page);
		const result = await editor.evaluate(async () => {
			const wp = (window as any).wp;
			await wp.data.dispatch('core/editor').editPost({
				title: 'Cross-origin editor',
				content: '<p>Saved through PHP</p>',
			});
			await wp.data.dispatch('core/editor').savePost();
			return wp.data.select('core/editor').getCurrentPostId();
		});
		expect(result).toBeGreaterThan(0);
		const title = await page.evaluate(async (id) => {
			const response = await (window as any).playgroundSites
				.getClient()
				.run({
					code: `<?php require '/wordpress/wp-load.php'; echo get_the_title(${id});`,
				});
			return response.text;
		}, result);
		expect(title).toBe('Cross-origin editor');
	});

	// Contract: editor previews show saved drafts and autosaves from their own running site.
	// Core saves asynchronously and reuses named tabs; either path can lose the sandbox's
	// service-worker partition, show stale content, or reuse another site's post ID.
	// WordPress 6.3 keeps its preview window object across clicks; later versions reopen
	// the window by name.
	for (const version of ['6.3', '6.9', 'beta']) {
		test(`editor previews preserve drafts and reused tabs on WordPress ${version}`, async ({
			page,
			browserName,
		}) => {
			await page.goto(`/?wp=${version}&php=8.3&storage=temp`);
			const editor = await openPostEditor(page, '/wp-admin/post-new.php');
			await editPreviewPost(
				editor,
				'Draft preview',
				'First draft content'
			);
			const opened = page.context().waitForEvent('page');
			await previewPost(editor);
			const popup = await opened;
			const preview = await previewContent(popup);
			await expect(preview.locator('body')).toContainText(
				'First draft content'
			);
			expect(new URL(popup.url()).origin).toBe(
				browserName === 'webkit' ? root : wpOrigin
			);
			expect(
				await preview
					.locator('body')
					.evaluate(() => window.location.origin)
			).toBe(wpOrigin);
			expect(
				await preview.locator('body').evaluate(() => {
					try {
						void window.parent.document;
						return 'accessible';
					} catch (error) {
						return (error as DOMException).name;
					}
				})
			).toBe(browserName === 'webkit' ? 'SecurityError' : 'accessible');

			await editPreviewPost(
				editor,
				'Updated draft preview',
				'Updated draft content'
			);
			await previewPost(editor);
			await expect(preview.locator('body')).toContainText(
				'Updated draft content'
			);
			await expect(preview.locator('body')).not.toContainText(
				'First draft content'
			);
			expect(page.context().pages()).toHaveLength(2);
			expect(
				await editor.evaluate(() =>
					(window as any).wp.data
						.select('core/editor')
						.getCurrentPostAttribute('status')
				)
			).toBe('draft');

			// Even an unchanged destination must reload after another Preview click.
			const reloaded = popup.waitForEvent('framenavigated', {
				predicate: (frame) =>
					frame.url().startsWith(wpOrigin + '/scope:'),
			});
			await previewPost(editor);
			await reloaded;
			await expect(preview.locator('body')).toContainText(
				'Updated draft content'
			);
			expect(page.context().pages()).toHaveLength(2);
			await popup.close();
			const reopened = page.context().waitForEvent('page');
			await previewPost(editor);
			const reopenedPreview = await reopened;
			await expect(
				(await previewContent(reopenedPreview)).locator('body')
			).toContainText('Updated draft content');
			await reopenedPreview.close();

			// Published posts use a separate autosave and nonce-bearing preview URL.
			const published = await openPostEditor(
				page,
				'/wp-admin/post.php?post=1&action=edit'
			);
			await editPreviewPost(
				published,
				'Unpublished revision',
				'Autosaved preview content'
			);
			const revisionOpened = page.context().waitForEvent('page');
			await previewPost(published);
			const revision = await revisionOpened;
			const revisionContent = await previewContent(revision);
			await expect(revisionContent.locator('body')).toContainText(
				'Autosaved preview content'
			);
			const destination = new URL(
				await revisionContent
					.locator('body')
					.evaluate(() => window.location.href)
			);
			expect(destination.searchParams.get('preview')).toBe('true');
			expect(destination.searchParams.get('preview_id')).toBe('1');
			expect(destination.searchParams.get('preview_nonce')).toBeTruthy();
			const original = await page.evaluate(async () => {
				const response = await (window as any).playgroundSites
					.getClient()
					.run({
						code: "<?php require '/wordpress/wp-load.php'; echo get_post(1)->post_content;",
					});
				return response.text;
			});
			expect(original).not.toContain('Autosaved preview content');
			await revision.close();
		});
	}

	test('editor previews keep two running sites separate', async ({
		page,
	}) => {
		await page.goto('/?wp=6.9&php=8.3&storage=temp');
		const firstEditor = await openPostEditor(
			page,
			'/wp-admin/post.php?post=1&action=edit'
		);
		await editPreviewPost(firstEditor, 'First site', 'First site preview');
		const firstOpened = page.context().waitForEvent('page');
		await previewPost(firstEditor);
		const firstPreview = await firstOpened;
		const firstContent = await previewContent(firstPreview);
		await expect(firstContent.locator('body')).toContainText(
			'First site preview'
		);

		// Related tabs can find one another's named windows. Both sites preview post 1.
		const secondOpened = page.waitForEvent('popup');
		await page.evaluate(
			(url) => window.open(url),
			root + '/?wp=6.9&php=8.3&storage=temp'
		);
		const second = await secondOpened;
		const secondEditor = await openPostEditor(
			second,
			'/wp-admin/post.php?post=1&action=edit'
		);
		await editPreviewPost(
			secondEditor,
			'Second site',
			'Second site preview'
		);
		const secondPreviewOpened = second.context().waitForEvent('page');
		await previewPost(secondEditor);
		const secondPreview = await secondPreviewOpened;
		const secondContent = await previewContent(secondPreview);
		await expect(secondContent.locator('body')).toContainText(
			'Second site preview'
		);
		await expect(firstContent.locator('body')).toContainText(
			'First site preview'
		);
		const firstUrl = new URL(
			await firstContent
				.locator('body')
				.evaluate(() => window.location.href)
		);
		const secondUrl = new URL(
			await secondContent
				.locator('body')
				.evaluate(() => window.location.href)
		);
		expect(firstUrl.pathname).not.toBe(secondUrl.pathname);

		await editPreviewPost(
			firstEditor,
			'First site updated',
			'First site updated preview'
		);
		await previewPost(firstEditor);
		await expect(firstContent.locator('body')).toContainText(
			'First site updated preview'
		);
		await expect(secondContent.locator('body')).toContainText(
			'Second site preview'
		);
		expect(page.context().pages()).toHaveLength(4);
		await secondPreview.close();
		await firstPreview.close();
		await second.close();
	});

	test('local-directory saving keeps the actual handle on the root origin', async ({
		page,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			'The directory-handle fixture requires Chromium OPFS.'
		);
		await page.goto('/?wp=6.9&php=8.3&storage=temp');
		await ready(page);
		await page.evaluate(() => {
			(window as any).pickerCalls = 0;
			// OPFS stands in for the OS picker; this checks the same-origin handle path,
			// not native permission prompts.
			(window as any).showDirectoryPicker = async () => {
				if (window !== window.top)
					throw new Error('Picker is not in the top-level app');
				(window as any).pickerCalls++;
				return (
					await navigator.storage.getDirectory()
				).getDirectoryHandle('picked-folder', { create: true });
			};
		});
		const saved = await page.evaluate(() =>
			(window as any).playgroundSites.saveToLocalFileSystem('Folder')
		);
		expect(saved.storage).toBe('local-fs');
		const wp = await ready(page);
		await page.evaluate(async () => {
			const client = (window as any).playgroundSites.getClient();
			await client.writeFile(
				'/wordpress/folder-marker.txt',
				'from the PHP mount'
			);
			await client.flushOpfs('/wordpress');
		});
		expect(
			await page.evaluate(async () => {
				const directory = await (
					await navigator.storage.getDirectory()
				).getDirectoryHandle('picked-folder');
				return (
					await (
						await directory.getFileHandle('folder-marker.txt')
					).getFile()
				).text();
			})
		).toBe('from the PHP mount');
		expect(await page.evaluate(() => (window as any).pickerCalls)).toBe(1);
		expect(page.context().pages()).toHaveLength(1);
		expect(
			await wp.evaluate(async () => {
				try {
					await (
						await navigator.storage.getDirectory()
					).getDirectoryHandle('picked-folder');
					return 'read';
				} catch (error) {
					return (error as DOMException).name;
				}
			})
		).toBe('NotFoundError');
	});

	test('site thumbnails render inside WordPress across the origin boundary', async ({
		page,
	}) => {
		await page.goto('/?wp=6.9&php=8.3&storage=temp');
		await ready(page);
		const thumbnail = await page.evaluate(() =>
			(window as any).playgroundSites.getClient().captureSiteThumbnail()
		);
		expect(['image/webp', 'image/jpeg']).toContain(thumbnail.mime);
		expect(Buffer.from(thumbnail.data, 'base64').length).toBeGreaterThan(
			100
		);
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

	test('OAuth popups keep their opener after visiting another origin', async ({
		page,
	}) => {
		await page.goto('/?storage=temp');
		await page.context().route('https://oauth-provider.test/**', (route) =>
			route.fulfill({
				contentType: 'text/html',
				body: `<script>location.replace(${JSON.stringify(root + '/?oauth-callback-probe=1&storage=temp')})</script>`,
			})
		);
		const opened = page.context().waitForEvent('page');
		await page.evaluate(() => {
			window.open('https://oauth-provider.test/authorize');
		});
		const popup = await opened;
		await popup.waitForURL(root + '/?oauth-callback-probe=1&storage=temp');
		expect(await popup.evaluate(() => window.opener !== null)).toBe(true);
		await popup.close();
	});

	// Core copies the preview link's target to a POST form. The preview page sets
	// its own window name independently; a mismatch opens a new tab on every click.
	async function classicPreviewReuse(page: Page) {
		await page.evaluate(async () => {
			const client = (window as any).playgroundSites.getClient();
			await client.writeFile(
				'/internal/shared/mu-plugins/classic-editor.php',
				"<?php add_filter('use_block_editor_for_post', '__return_false');"
			);
			await client.goTo('/wp-admin/post-new.php');
		});
		const editor = await ready(page);
		await editor.locator('#content-html').click();
		await editor.locator('#title').fill('Classic preview');
		await editor.locator('#content').fill('First classic preview');
		const opened = page.context().waitForEvent('page');
		await editor.locator('#post-preview').click();
		const preview = await opened;
		await expect(preview.locator('body')).toContainText(
			'First classic preview'
		);
		expect(await preview.evaluate(() => window.name)).toBe(
			await editor.locator('#post-preview').getAttribute('target')
		);
		await editor.locator('#content').fill('Updated classic preview');
		await editor.locator('#post-preview').click();
		await expect(preview.locator('body')).toContainText(
			'Updated classic preview'
		);
		expect(page.context().pages()).toHaveLength(2);
		// Scripts can also reuse Core's already-suffixed target without adding it twice.
		await editor.evaluate(() => {
			const link = document.querySelector(
				'#post-preview'
			) as HTMLAnchorElement;
			window.open('', link.target);
		});
		expect(page.context().pages()).toHaveLength(2);
		await preview.close();
	}

	/** Locate WordPress in the direct tab or Safari's app-origin wrapper. */
	async function previewContent(page: Page) {
		await page.waitForURL(
			(url) => url.origin === root || url.origin === wpOrigin
		);
		return new URL(page.url()).origin === root
			? page.frameLocator('#wp')
			: page;
	}

	async function openPostEditor(page: Page, path: string): Promise<Frame> {
		await ready(page);
		await page.evaluate(
			(path) => (window as any).playgroundSites.getClient().goTo(path),
			path
		);
		const editor = await ready(page);
		await editor.waitForFunction(() =>
			Boolean(
				(window as any).wp?.data
					?.select('core/editor')
					?.getCurrentPostId()
			)
		);
		// The guide may render after this point. A preference hides it either way.
		await editor.evaluate(() =>
			(window as any).wp.data
				.dispatch('core/preferences')
				.set('core/edit-post', 'welcomeGuide', false)
		);
		await expect(
			editor.getByRole('dialog', { name: /^Welcome to the/ })
		).toBeHidden();
		await expect(viewMenu(editor)).toBeVisible();
		return editor;
	}

	async function editPreviewPost(
		editor: Frame,
		title: string,
		content: string
	) {
		await editor.evaluate(
			({ title, content }) => {
				const { blocks, data } = (window as any).wp;
				const store = data.dispatch('core/editor');
				store.editPost({ title });
				// WordPress 6.3 saves the editor's blocks over an edited content string.
				store.resetEditorBlocks(
					blocks.parse(
						`<!-- wp:paragraph --><p>${content}</p><!-- /wp:paragraph -->`
					)
				);
			},
			{ title, content }
		);
	}

	async function previewPost(editor: Frame) {
		const preview = editor.getByRole('menuitem', { name: /^Preview/ });
		// WordPress 6.3 leaves this menu open after a preview; later versions close it.
		if (!(await preview.isVisible())) {
			await viewMenu(editor).click();
		}
		await preview.click();
	}

	/** WordPress 6.5 renamed the editor's Preview menu to View. */
	function viewMenu(editor: Frame) {
		return editor.getByRole('button', { name: /^(View|Preview)$/ });
	}

	/**
	 * Model a WordPress plugin replacing cached helper HTML with its own script.
	 *
	 * Prepend a visible execution marker to the real helper, keeping its normal
	 * request connection working. A broken helper or boot timeout must not pass
	 * as protection against the injected script. Replace matching entries in every
	 * existing cache, including older releases, and create an attacker-named cache:
	 * user code on the WordPress origin can write all of them, not just its own.
	 */
	async function poisonHelperCache(wp: Frame) {
		const helper = wp
			.parentFrame()!
			.childFrames()
			.find((frame) =>
				isWordPressBridgePath(new URL(frame.url()).pathname)
			)!;
		const helperPath = new URL(helper.url()).pathname;
		await wp.evaluate(async (helperPath) => {
			const url = new URL(helperPath, window.location.origin).href;
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
					(key) => new URL(key.url).pathname === helperPath
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
		}, helperPath);
	}

	/**
	 * Check that an embedded app API can complete its normal isReady() handshake.
	 *
	 * Create the iframe below the supplied page or frame with no referrer and no
	 * extra origin parameter, as existing integrations may do. Retry the legacy
	 * APPLY message while the document boots; only this iframe's reply for the
	 * generated request ID counts as success. Remove the iframe and timers on
	 * success or timeout. A timeout returns false; it does not explain why boot
	 * failed, so these embed-compatibility checks require a successful handshake.
	 */
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

					/**
					 * Match the reply to this iframe, app origin, and request ID.
					 * Other Playground frames also send API messages during boot;
					 * accepting one of those would hide a broken embedded API.
					 */
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

	/**
	 * Return the visible WordPress frame only after the app and site have booted.
	 *
	 * Wait for the selected site's API, a nonempty document, and the configured
	 * WordPress origin with a /scope:... path. A browser error page can also deny
	 * parent access; treating that as a loaded site would make security checks pass
	 * when the real HTTP connection was broken. Read the frame from the visible
	 * viewport element so hidden request helpers are not mistaken for WordPress.
	 */
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
