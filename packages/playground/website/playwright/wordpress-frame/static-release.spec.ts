import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile, writeFile, rm, rename } from 'node:fs/promises';
import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js';
import { joinPaths } from '@php-wasm/util';
import { installLocalRelease } from '../../bin/wordpress-frame/install.mjs';
import {
	appOrigin,
	wordPressOrigin,
} from '../../bin/wordpress-frame/origins.mjs';

const directory = joinPaths(
	__dirname,
	'../../../../../dist/packages/playground/wordpress-frame-public'
);
const upload = joinPaths(
	__dirname,
	'../../../../../dist/packages/playground/wordpress-frame-upload'
);
let selector: string;
let release: string;

test.describe('Static release startup', { tag: '@storage' }, () => {
	test.beforeAll(async () => {
		selector = await readFile(joinPaths(directory, 'index.html'), 'utf8');
		release = JSON.parse(
			selector.match(
				/<script id="playground-release" type="application\/json">(.*?)<\/script>/s
			)![1]
		).release;
	});
	test.afterEach(async () => {
		await writeFile(joinPaths(directory, 'index.html.restore'), selector);
		await rename(
			joinPaths(directory, 'index.html.restore'),
			joinPaths(directory, 'index.html')
		);
		await rm(joinPaths(upload, 'release-routing-probe.txt'), {
			force: true,
		});
	});

	test('existing documents retain their files when another tab activates a new release', async ({
		page,
		context,
	}) => {
		await writeFile(
			joinPaths(
				directory,
				'releases',
				release,
				'release-routing-probe.txt'
			),
			'release A'
		);
		await writeFile(
			joinPaths(upload, 'release-routing-probe.txt'),
			'release B'
		);
		await page.goto('/?wp=6.9&php=8.3&storage=temp');
		await ready(page);
		expect(
			await page
				.frameLocator(
					'#playground-viewport:visible,.playground-viewport:visible'
				)
				.frameLocator('#wp')
				.locator('body')
				.evaluate(() => navigator.serviceWorker.controller!.scriptURL)
		).toContain(`/sandbox-sw-${release}.js?release=${release}`);
		expect(
			await page.evaluate(async () =>
				(await fetch('/release-routing-probe.txt')).text()
			)
		).toBe('release A');
		installLocalRelease(upload, directory, appOrigin, wordPressOrigin);
		const other = await context.newPage();
		await other.goto(appOrigin + '/?wp=6.9&php=8.3&storage=temp');
		await ready(other);
		expect(
			await other.evaluate(async () =>
				(await fetch('/release-routing-probe.txt')).text()
			)
		).toBe('release B');
		// The new worker has no in-memory record of the original tab. Its retained pin must survive.
		expect(
			await page.evaluate(async () =>
				(await fetch('/release-routing-probe.txt')).text()
			)
		).toBe('release A');
		expect(
			await page.evaluate(
				() => navigator.serviceWorker.controller!.scriptURL
			)
		).toBe(
			await other.evaluate(
				() => navigator.serviceWorker.controller!.scriptURL
			)
		);
		await other.close();
	});

	test('wrong-origin documents and worker registrations fail before app startup', async ({
		page,
	}) => {
		// Firefox reports a logged Error object's text as "Error", without its message.
		const originFailure = page.waitForEvent('console', {
			predicate: async (message) =>
				message.type() === 'error' &&
				(await message
					.args()[0]
					?.evaluate((error) => error?.message)) ===
					'Incorrect Playground app hostname.',
		});
		await page.goto(`${wordPressOrigin}/releases/${release}/remote.html`);
		await originFailure;
		expect(
			await page.evaluate(() => Boolean((window as any).playground))
		).toBe(false);
		const result = await page.evaluate(
			async ({ release }) => {
				const correct = new URL(
					`/sandbox-sw-${release}.js`,
					window.location.origin
				);
				correct.searchParams.set('release', release);
				const registration = await navigator.serviceWorker.register(
					correct,
					{ type: 'module', scope: '/' }
				);
				await navigator.serviceWorker.ready;
				const worker =
					registration.installing ??
					registration.waiting ??
					registration.active!;
				while (worker.state !== 'activated')
					await new Promise<void>((resolve) =>
						worker.addEventListener(
							'statechange',
							() => resolve(),
							{ once: true }
						)
					);
				let rejected = false;
				try {
					await navigator.serviceWorker.register(
						`/app-sw-${release}.js?release=${release}`,
						{ type: 'module', scope: '/' }
					);
				} catch {
					rejected = true;
				}
				return { rejected, active: registration.active!.scriptURL };
			},
			{ release }
		);
		expect(result.rejected).toBe(true);
		expect(result.active).toContain(`/sandbox-sw-${release}.js`);
	});

	test('an archived worker discovers the root selector without consulting a cached JSON selector', async ({
		page,
	}) => {
		const seed = '__static-release-seed.html';
		const worker = '__previous-static-worker.js';
		const manifest = joinPaths(
			directory,
			'assets-required-for-offline-mode.json'
		);
		const previousManifest = await readFile(manifest).catch(
			() => undefined
		);
		const archive = new ZipReader(
			new BlobReader(
				new Blob([
					await readFile(
						joinPaths(__dirname, '../deploy-e2e-mid-release.zip')
					),
				])
			)
		);
		const previousWorker = (await archive.getEntries()).find(
			(entry) =>
				entry.filename ===
				'dist/packages/playground/wasm-wordpress-net-mid/sw.js'
		);
		if (!previousWorker || previousWorker.directory)
			throw new Error('Missing archived service worker.');
		const script = await previousWorker.getData!(new TextWriter());
		await archive.close();
		await writeFile(
			joinPaths(directory, seed),
			'<!doctype html><title>Previous worker seed</title>'
		);
		await writeFile(joinPaths(directory, worker), script);
		// The old worker's eager prefetch is unrelated to migration. Keep its real
		// routing and caching implementation while avoiding every unused runtime download.
		await writeFile(manifest, '[]');
		try {
			await page.goto('/' + seed);
			await page.evaluate(async (url) => {
				const registration = await navigator.serviceWorker.register(
					url,
					{
						type: 'module',
						scope: '/',
					}
				);
				await navigator.serviceWorker.ready;
				const active =
					registration.installing ??
					registration.waiting ??
					registration.active!;
				while (active.state !== 'activated') {
					if (active.state === 'redundant')
						throw new Error('Archived worker failed to install.');
					await new Promise<void>((resolve) =>
						active.addEventListener(
							'statechange',
							() => resolve(),
							{ once: true }
						)
					);
				}
			}, '/' + worker);
			// Older registrations need not claim the document that installs them.
			await page.reload();
			await page.evaluate(async () => {
				for (const name of await caches.keys()) {
					await (
						await caches.open(name)
					).put('/current-release.json', new Response('{}'));
				}
			});
			await page.goto('/?wp=6.9&php=8.3&storage=temp');
			await ready(page);
			expect(
				await page.evaluate(
					() => navigator.serviceWorker.controller!.scriptURL
				)
			).toContain(`/app-sw-${release}.js`);
		} finally {
			await rm(joinPaths(directory, seed), { force: true });
			await rm(joinPaths(directory, worker), { force: true });
			if (previousManifest) await writeFile(manifest, previousManifest);
			else await rm(manifest, { force: true });
		}
	});
});

async function ready(page: Page) {
	await page.waitForFunction(() => Boolean((window as any).playgroundSites));
	await page.evaluate(() => (window as any).playgroundSites.isReady());
	await expect(
		page
			.frameLocator(
				'#playground-viewport:visible,.playground-viewport:visible'
			)
			.frameLocator('#wp')
			.locator('body')
	).not.toBeEmpty();
}
