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
			await test.step(
				`WordPress transport ${content}`,
				async () => {
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
				},
				{ timeout: 60000 }
			);
		}
		const sandboxPath = await sandbox.evaluate(
			() => window.location.pathname
		);
		await test.step(
			'Reject WordPress execution on the app origin',
			async () => {
				expect(
					await page.evaluate(
						async (url) => (await fetch(url)).status,
						appOrigin + sandboxPath
					)
				).toBe(404);
			},
			{ timeout: 60000 }
		);

		// Compare the actual controllers verified by startup, rather than waiting
		// on a registration's newest active worker through a separate ready promise.
		const controllers = await Promise.all(
			[page, withReprint].map((tab) =>
				tab.evaluate(
					() => navigator.serviceWorker.controller!.scriptURL
				)
			)
		);
		expect(controllers[0]).toBe(controllers[1]);
		expect(new URL(controllers[0]).searchParams.has('reprint')).toBe(false);

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
	await page.waitForFunction(
		() => Boolean((window as any).playgroundSites),
		undefined,
		{ timeout: 60000 }
	);
	await test.step(
		`App client ready at ${page.url()}`,
		async () => {
			await page.evaluate(() =>
				(window as any).playgroundSites.isReady()
			);
		},
		{ timeout: 60000 }
	);
	const viewport = await page
		.locator('#playground-viewport:visible,.playground-viewport:visible')
		.elementHandle();
	const runtime = (await viewport!.contentFrame())!;
	await viewport!.dispose();
	const element = (
		await runtime.evaluateHandle(() =>
			document.querySelector<HTMLIFrameElement>('#wp')
		)
	).asElement()!;
	const frame = (await element.contentFrame())!;
	await element.dispose();
	// Firefox can retain an obsolete utility context after service-worker
	// navigation. Resolve the frame once, then inspect its live main-world document
	// instead of a nested body locator or the stale Frame.url() metadata.
	await expect
		.poll(() =>
			frame.evaluate(() => ({
				origin: window.location.origin,
				pathname: window.location.pathname,
				hasBodyContent: Boolean(document.body?.textContent?.trim()),
			}))
		)
		.toEqual({
			origin,
			pathname: expect.stringMatching(/^\/scope:/),
			hasBodyContent: true,
		});
	return frame;
}
