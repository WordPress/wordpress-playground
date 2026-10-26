import { expect, test } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { WebsitePage } from '../website-page';
import {
	appOrigin,
	wordPressOrigin,
} from '../../bin/wordpress-frame/origins.mjs';

// Both tabs share service workers and caches. Keep OPFS operations in the storage lane.
test.describe('WordPress sandbox opt-in', { tag: '@storage' }, () => {
	test('ordinary and opted-in tabs keep their HTTP routes under one app worker', async ({
		page,
		context,
	}) => {
		await page.goto('/?wp=6.9&php=8.3&storage=temp');
		const ordinary = await ready(page, appOrigin);
		const optedIn = await context.newPage();
		await optedIn.goto(appOrigin + '/?reprint&wp=6.9&php=8.3&storage=temp');
		const sandbox = await ready(optedIn, wordPressOrigin);

		for (const [tab, frame, content] of [
			[page, ordinary, 'ordinary HTTP'],
			[optedIn, sandbox, 'sandbox HTTP'],
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
			[page, optedIn].map((tab) =>
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

		// Losing ?reprint during SPA navigation must not move the next PHP iframe.
		// The URL router starts the replacement site. Do not also start one through
		// the API: the two boots can replace each other before either promise settles.
		await optedIn.evaluate(() => {
			(window as any).sameDocument = true;
			const url = new URL(window.location.href);
			url.searchParams.delete('reprint');
			window.history.replaceState({}, '', url.href);
		});
		await expect.poll(() => sandbox.isDetached()).toBe(true);
		await ready(optedIn, wordPressOrigin);
		expect(await optedIn.evaluate(() => (window as any).sameDocument)).toBe(
			true
		);

		// A new document without the flag deliberately goes back to one origin.
		await optedIn.goto(appOrigin + '/?wp=6.9&php=8.3&storage=temp');
		await ready(optedIn, appOrigin);
		await optedIn.close();
	});

	test('saved sites follow the current document flag when reopened', async ({
		page,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			'Saved-site checks need browser OPFS.'
		);
		await page.goto('/?reprint&wp=6.9&php=8.3&storage=temp');
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
			await new WebsitePage(page).openSavedPlayground();
			const frame = await ready(page, flag ? wordPressOrigin : appOrigin);
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
