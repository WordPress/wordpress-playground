import { expect, test } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import {
	appOrigin,
	wordPressOrigin,
} from '../../bin/wordpress-frame/origins.mjs';

// Both tabs share service workers and caches. Keep OPFS operations in the storage lane.
test.describe('WordPress sandbox by default', { tag: '@storage' }, () => {
	test('tabs with and without Reprint use the sandbox and share one app worker', async ({
		page,
		context,
	}) => {
		await page.goto('/?wp=6.9&php=8.3&storage=temp');
		const withoutReprint = await ready(page, wordPressOrigin);
		const withReprint = await context.newPage();
		await withReprint.goto(
			appOrigin + '/?reprint&wp=6.9&php=8.3&storage=temp'
		);
		const sandbox = await ready(withReprint, wordPressOrigin);

		for (const [tab, frame, content] of [
			[page, withoutReprint, 'without Reprint'],
			[withReprint, sandbox, 'with Reprint'],
		] as const) {
			await tab.evaluate(async (text) => {
				await (window as any).playgroundSites
					.getClient()
					.writeFile('/wordpress/origin-mode.txt', text);
			}, content);
			expect(
				await frame.evaluate(async () =>
					(await fetch('origin-mode.txt')).text()
				)
			).toBe(content);
		}
		const sandboxPath = await sandbox.evaluate(
			() => window.location.pathname
		);
		expect(
			await page.evaluate(
				async (url) => (await fetch(url)).status,
				appOrigin + sandboxPath
			)
		).toBe(404);

		const registrations = await Promise.all(
			[page, withReprint].map((tab) =>
				tab.evaluate(
					async () =>
						(await navigator.serviceWorker.ready).active!.scriptURL
				)
			)
		);
		expect(registrations[0]).toBe(registrations[1]);
		expect(new URL(registrations[0]).searchParams.has('reprint')).toBe(
			false
		);

		// Changing feature flags in the SPA must not change the WordPress origin.
		// The URL router starts the replacement site. Do not also start one through
		// the API: the two boots can replace each other before either promise settles.
		await withReprint.evaluate(() => {
			(window as any).sameDocument = true;
			const url = new URL(window.location.href);
			url.searchParams.delete('reprint');
			window.history.replaceState({}, '', url.href);
		});
		await expect.poll(() => sandbox.isDetached()).toBe(true);
		await ready(withReprint, wordPressOrigin);
		expect(
			await withReprint.evaluate(() => (window as any).sameDocument)
		).toBe(true);

		// A full reload without the flag must keep WordPress off the app origin too.
		await withReprint.goto(appOrigin + '/?wp=6.9&php=8.3&storage=temp');
		await ready(withReprint, wordPressOrigin);
		await withReprint.close();
	});

	test('saved sites keep the sandbox origin when reopened with or without Reprint', async ({
		page,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			'Saved-site checks need browser OPFS.'
		);
		await page.goto('/?wp=6.9&php=8.3&storage=temp');
		await ready(page, wordPressOrigin);
		const site = await page.evaluate(async () => {
			const api = (window as any).playgroundSites;
			await api
				.getClient()
				.writeFile('/wordpress/mode-persist.txt', 'saved bytes');
			const saved = await api.saveInBrowser();
			return saved;
		});
		await ready(page, wordPressOrigin);
		await page.evaluate(() =>
			(window as any).playgroundSites.getClient().flushOpfs('/wordpress')
		);
		for (const flag of ['reprint&', '']) {
			await page.goto(
				'/?' + flag + 'site-slug=' + encodeURIComponent(site.slug)
			);
			const frame = await ready(page, wordPressOrigin);
			expect(
				await frame.evaluate(async () =>
					(await fetch('mode-persist.txt')).text()
				)
			).toBe('saved bytes');
		}
	});
});

/** Require a live WordPress document, not an error page at the expected hostname. */
async function ready(page: Page, origin: string): Promise<Frame> {
	await page.waitForFunction(() => Boolean((window as any).playgroundSites));
	await page.evaluate(() => (window as any).playgroundSites.isReady());
	const iframe = page
		.frameLocator(
			'#playground-viewport:visible,.playground-viewport:visible'
		)
		.locator('#wp');
	await expect(iframe.contentFrame().locator('body')).not.toBeEmpty();
	const element = (await iframe.elementHandle())!;
	const frame = (await element.contentFrame())!;
	await element.dispose();
	// Read the live document's location, not Playwright's Frame.url(). Firefox
	// can leave that metadata at about:blank after a service-worker navigation.
	// The loading document also has a body, so require the real scoped URL too.
	await expect
		.poll(() =>
			frame.evaluate(() => ({
				origin: window.location.origin,
				pathname: window.location.pathname,
			}))
		)
		.toEqual({ origin, pathname: expect.stringMatching(/^\/scope:/) });
	return frame;
}
