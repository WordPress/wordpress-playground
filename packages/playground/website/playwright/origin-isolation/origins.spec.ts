import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { getDirectoryNameForSlug } from '../../src/lib/state/opfs/opfs-site-path';

// These exercise the real cross-origin boundary, not a mocked postMessage call.
// A future bridge handler must not turn metadata/setup access into file access.
test('a site can change only its own catalogue entry', async ({
	page,
	context,
}) => {
	await page.goto('http://site-aaaa.playground.localhost:9400/manifest.json');
	const other = await context.newPage();
	await other.goto(
		'http://site-bbbb.playground.localhost:9400/manifest.json'
	);
	const bridge = 'http://playground.localhost:9400/origin-isolation.html';
	await Promise.all([
		bridgeRequest(page, bridge, 'catalogue', {
			name: 'Alpha',
			storage: 'opfs',
		}),
		bridgeRequest(other, bridge, 'catalogue', {
			name: 'Beta',
			storage: 'opfs',
		}),
	]);
	const response = await bridgeRequest(other, bridge, 'catalogue', {
		origin: 'http://site-aaaa.playground.localhost:9400',
		name: 'Attempted rename of Alpha',
		storage: 'opfs',
	});
	expect(response.value).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				origin: 'http://site-aaaa.playground.localhost:9400',
				name: 'Alpha',
			}),
			expect.objectContaining({
				origin: 'http://site-bbbb.playground.localhost:9400',
				name: 'Attempted rename of Alpha',
			}),
		])
	);
	const afterDelete = await bridgeRequest(other, bridge, 'catalogue', null);
	expect(afterDelete.value).toEqual([
		expect.objectContaining({
			origin: 'http://site-aaaa.playground.localhost:9400',
			name: 'Alpha',
		}),
	]);
	expect(
		(await bridgeRequest(page, bridge, 'exportSavedSiteAsZip', 'beta'))
			.error
	).toContain('Unsupported');
});

test('setup cannot replace existing files or a previously claimed empty origin', async ({
	page,
	context,
}) => {
	await page.goto('http://site-aaaa.playground.localhost:9400/manifest.json');
	const existing = await context.newPage();
	await existing.goto(
		'http://site-bbbb.playground.localhost:9400/manifest.json'
	);
	await existing.evaluate(async () => {
		const file = await (
			await navigator.storage.getDirectory()
		).getFileHandle('private.txt', { create: true });
		const writer = await file.createWritable();
		await writer.write('Beta private data');
		await writer.close();
	});
	const rejected = await bridgeRequest(
		page,
		'http://site-bbbb.playground.localhost:9400/origin-isolation.html',
		'setup',
		{
			url: 'http://site-bbbb.playground.localhost:9400/',
			storage: 'temporary',
		}
	);
	expect(rejected.error).toContain('already has files');
	expect(
		await existing.evaluate(async () =>
			(
				await (
					await (
						await navigator.storage.getDirectory()
					).getFileHandle('private.txt')
				).getFile()
			).text()
		)
	).toBe('Beta private data');

	const bridge =
		'http://site-cccc.playground.localhost:9400/origin-isolation.html';
	const setup = {
		url: 'http://site-cccc.playground.localhost:9400/',
		storage: 'temporary',
	};
	const attempts = await Promise.all([
		bridgeRequest(page, bridge, 'setup', setup),
		bridgeRequest(page, bridge, 'setup', setup),
	]);
	expect(attempts.filter((attempt) => !attempt.error)).toHaveLength(1);
	expect(attempts.filter((attempt) => attempt.error)).toEqual([
		expect.objectContaining({
			error: expect.stringContaining('already in use'),
		}),
	]);
});

test('site creation APIs navigate to distinct origins and preserve the source files', async ({
	page,
}) => {
	await page.goto('./?wp=6.9&php=8.3');
	await ready(page);
	const firstOrigin = new URL(page.url()).origin;
	await page.evaluate(async () => {
		const client = (window as any).playgroundSites.getClient();
		await client.writeFile(
			'/wordpress/source-marker.txt',
			'source is intact'
		);
		await client.flushOpfs('/wordpress');
	});
	const refusal = await page.evaluate(async () => {
		try {
			await (window as any).playgroundSites.createNewSavedSite(
				'no-navigation',
				undefined,
				{ updateUrl: false }
			);
		} catch (error) {
			return String(error);
		}
	});
	expect(refusal).toContain('requires navigating');
	expect(new URL(page.url()).origin).toBe(firstOrigin);
	for (const storage of ['opfs', 'temporary']) {
		const before = new URL(page.url()).origin;
		await page.evaluate((storage) => {
			const api = (window as any).playgroundSites;
			void (storage === 'opfs'
				? api.createNewSavedSite('same-name')
				: api.createNewTemporarySite('same-name'));
		}, storage);
		await page.waitForURL((url) => url.origin !== before);
		await ready(page);
		expect(
			await page.evaluate(() => (window as any).playgroundSites.list())
		).toEqual([expect.objectContaining({ storage, isActive: true })]);
		expect(
			await page.evaluate(() =>
				(window as any).playgroundSites
					.getClient()
					.fileExists('/wordpress/source-marker.txt')
			)
		).toBe(false);
	}
	await page.goto(firstOrigin);
	await ready(page);
	expect(
		await page.evaluate(() =>
			(window as any).playgroundSites
				.getClient()
				.readFileAsText('/wordpress/source-marker.txt')
		)
	).toBe('source is intact');
});

test('rename and delete update the shared list without reusing the deleted origin', async ({
	page,
	context,
}) => {
	await page.goto('./?wp=6.9&php=8.3');
	await ready(page);
	const origin = new URL(page.url()).origin;
	const observer = await context.newPage();
	await observer.goto(
		'http://site-dddd.playground.localhost:9400/manifest.json'
	);
	const bridge = 'http://playground.localhost:9400/origin-isolation.html';
	await page.evaluate(() =>
		(window as any).playgroundSites.rename('Renamed Alpha')
	);
	await expect
		.poll(
			async () =>
				(await bridgeRequest(observer, bridge, 'catalogue', undefined))
					.value
		)
		.toEqual([expect.objectContaining({ origin, name: 'Renamed Alpha' })]);
	await page.evaluate(() => {
		const api = (window as any).playgroundSites;
		void api.delete(api.list().find((site: any) => site.isActive).slug);
	});
	await page.waitForURL((url) => url.origin !== origin);
	await ready(page);
	await expect
		.poll(async () =>
			(
				await bridgeRequest(observer, bridge, 'catalogue', undefined)
			).value.some((site: any) => site.origin === origin)
		)
		.toBe(false);
});

test('reloading a temporary site does not reuse its old storage origin', async ({
	page,
}) => {
	await page.goto('./?storage=temp&wp=6.9&php=8.3');
	await ready(page);
	const previous = new URL(page.url()).origin;
	await page.evaluate(async () => {
		const root = await navigator.storage.getDirectory();
		await root.getFileHandle('old-site-only.txt', { create: true });
	});
	await page.reload();
	await page.waitForURL((url) => url.origin !== previous);
	await ready(page);
	expect(
		await page.evaluate(async () => {
			const root = await navigator.storage.getDirectory();
			const names: string[] = [];
			for await (const name of root.keys()) names.push(name);
			return names;
		})
	).not.toContain('old-site-only.txt');
});

test('a saved site reloads offline without prefetching unused runtimes', async ({
	page,
	context,
}) => {
	await page.goto('./?wp=6.9&php=8.3');
	await ready(page);
	await page.evaluate(async () => {
		const client = (window as any).playgroundSites.getClient();
		await client.backfillStaticFilesRemovedFromMinifiedBuild();
		await client.writeFile(
			'/wordpress/offline-marker.txt',
			'saved before going offline'
		);
		await client.flushOpfs('/wordpress');
	});
	const shell: string[] = await page.evaluate(async () =>
		(await fetch('/assets-required-for-offline-mode.json')).json()
	);
	expect(
		shell.some((url) => /\.(wasm|zip|zst)$|php-next|\/optional\//.test(url))
	).toBe(false);
	await expect
		.poll(() =>
			page.evaluate(async (urls) => {
				const results = await Promise.all(
					urls.map((url) =>
						caches.match(new URL(url, window.location.href))
					)
				);
				return urls.filter((_url, index) => !results[index]);
			}, shell)
		)
		.toEqual([]);
	await context.setOffline(true);
	await page.reload();
	await ready(page);
	expect(
		await page.evaluate(() =>
			(window as any).playgroundSites
				.getClient()
				.readFileAsText('/wordpress/offline-marker.txt')
		)
	).toBe('saved before going offline');
});

test('shared assets cannot serve an app document under another spelling', async ({
	page,
}) => {
	await page.goto('./manifest.json');
	const assets = await page.evaluate(async () =>
		(await fetch('/assets-required-for-offline-mode.json')).json()
	);
	const base = new URL(
		assets.find((url: string) => url.startsWith('http://static.'))
	);
	const release = base.pathname.split('/')[1];
	for (const path of [
		'index.html',
		'index.HTML',
		'index.%68tml',
		'api.html',
		'remote.html',
		'origin-isolation.html',
	]) {
		const response = await page.request.get(
			`http://127.0.0.1:9400/${release}/${path}`,
			{
				headers: { host: base.host },
			}
		);
		expect(response.status()).toBe(404);
	}
});

test('site origins do not offer GitHub sign-in or request a token', async ({
	page,
}) => {
	const requested: string[] = [];
	page.on('request', (request) => {
		if (request.url().includes('oauth.php')) requested.push(request.url());
	});
	await page.goto('./?gh-ensure-auth=yes');
	const dialog = page.getByRole('dialog', { name: 'Connect to GitHub' });
	await expect(dialog.getByRole('alert')).toContainText(
		'GitHub sign-in is disabled'
	);
	await expect(
		dialog.getByRole('link', { name: 'Connect your GitHub account' })
	).toHaveCount(0);
	expect(requested).toEqual([]);
});

async function ready(page: Page) {
	await page.waitForFunction(() => Boolean((window as any).playgroundSites));
	await page.evaluate(() => (window as any).playgroundSites.isReady());
	const site = await page.evaluate(() =>
		(window as any).playgroundSites
			.list()
			.find((site: any) => site.isActive)
	);
	if (site.storage === 'opfs') {
		// API readiness precedes the first MEMFS-to-OPFS copy. Do not treat it
		// as storage readiness when testing reloads or flushing persisted edits.
		await expect
			.poll(() =>
				page.evaluate(async (directory) => {
					try {
						const root = await navigator.storage.getDirectory();
						const sites = await root.getDirectoryHandle('sites');
						const site = await sites.getDirectoryHandle(directory);
						const metadata = await (
							await site.getFileHandle('wp-runtime.json')
						).getFile();
						return (
							JSON.parse(await metadata.text())
								.initialOpfsSyncPending === false
						);
					} catch {
						return false;
					}
				}, getDirectoryNameForSlug(site.slug))
			)
			.toBe(true);
	}
}

async function bridgeRequest(
	page: Page,
	url: string,
	action: string,
	value?: unknown
) {
	return await page.evaluate(
		async ({ url, action, value }) => {
			const frame = document.createElement('iframe');
			frame.src = url;
			await new Promise<void>((resolve) => {
				frame.onload = () => resolve();
				document.body.append(frame);
			});
			const id = crypto.randomUUID();
			return await new Promise<{ error?: string; value?: unknown }>(
				(resolve, reject) => {
					const timeout = setTimeout(() => {
						frame.remove();
						reject(new Error('Bridge timed out'));
					}, 10000);
					const receive = (event: MessageEvent) => {
						if (
							event.source !== frame.contentWindow ||
							event.origin !== new URL(url).origin ||
							event.data?.id !== id
						)
							return;
						clearTimeout(timeout);
						window.removeEventListener('message', receive);
						frame.remove();
						resolve(event.data);
					};
					window.addEventListener('message', receive);
					frame.contentWindow!.postMessage(
						{ type: 'playground-origin', id, action, value },
						new URL(url).origin
					);
				}
			);
		},
		{ url, action, value }
	);
}
