/**
 * Check that a WordPress-created popup cannot automatically boot a saved site.
 *
 * A saved PHP endpoint would change a marker file if it ran. Stop that runtime,
 * open its app URL from another WordPress page, and require a choice in the site
 * list before any remote.html appears. Reopen deliberately and inspect the marker.
 * Use the raw popup for negative checks: WebsitePage.goto() selects saved sites
 * through the list for ordinary tests. This checks URL startup, not every app API.
 */
import { test, expect } from '../playground-fixtures';

// Saved-site startup uses app-origin OPFS, just like the other storage checks.
test.describe('Saved Playground startup', { tag: '@storage' }, () => {
	test('a WordPress popup leaves saved files stopped until the user selects the site', async ({
		website,
		context,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			'Saved-site checks require OPFS.'
		);
		await website.goto('./?storage=temp&wp=6.9&php=8.3');
		const saved = await website.page.evaluate(async () => {
			const api = (window as any).playgroundSites;
			await api
				.getClient()
				.writeFile('/wordpress/startup-marker.txt', 'not requested');
			await api
				.getClient()
				.writeFile(
					'/wordpress/startup-probe.php',
					'<?php file_put_contents(__DIR__ . "/startup-marker.txt", "requested"); echo "started saved PHP";'
				);
			const site = await api.saveInBrowser('Saved startup test');
			return site;
		});
		await website.waitForNestedIframes();
		const savedHttpUrl = await website.page.evaluate(async () => {
			await (window as any).playgroundSites.isReady();
			const client = (window as any).playgroundSites.getClient();
			await client.flushOpfs('/wordpress');
			return await client.absoluteUrl;
		});
		expect(saved.slug).toMatch(
			/-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
		);
		const probeUrl = new URL(`${savedHttpUrl}/startup-probe.php`).href;
		expect(
			await website
				.wordpress()
				.locator('body')
				.evaluate(
					async (_body, url) => (await fetch(url)).text(),
					probeUrl
				)
		).toBe('started saved PHP');
		await website.page.evaluate(async () => {
			const client = (window as any).playgroundSites.getClient();
			await client.writeFile(
				'/wordpress/startup-marker.txt',
				'not requested'
			);
			await client.flushOpfs('/wordpress');
		});
		await website.page.evaluate(() =>
			(window as any).playgroundSites.createNewTemporarySite('other-site')
		);
		await website.waitForNestedIframes();
		await expect
			.poll(() =>
				website.page.locator('iframe.playground-viewport').count()
			)
			.toBe(1);
		const wordpress = website.wordpress();
		expect(
			await wordpress
				.locator('body')
				.evaluate(() => window.location.origin)
		).toBe(new URL(savedHttpUrl).origin);
		const savedUrl = new URL('./', website.page.url());
		savedUrl.search = '';
		savedUrl.searchParams.set('site-slug', saved.slug);
		// The website must still offer its list when a saved link asks for seamless
		// mode. After selection, return to that mode without weakening the boot rule.
		savedUrl.searchParams.set('mode', 'seamless');
		if (process.env.PLAYWRIGHT_WORDPRESS_FRAME === '1') {
			savedUrl.searchParams.set('reprint', '');
		}
		const popupPromise = context.waitForEvent('page');
		await wordpress.locator('body').evaluate((body, url) => {
			const button = document.createElement('button');
			button.textContent = 'Open saved site from WordPress';
			button.onclick = () => {
				// A scoped referrer makes same-origin builds redirect back to WordPress.
				// Omit it so the popup reaches the app URL we are trying to attack.
				window.open(url, '_blank', 'noreferrer');
			};
			body.prepend(button);
		}, savedUrl.href);
		await wordpress
			.getByRole('button', { name: 'Open saved site from WordPress' })
			.click();
		const popup = await popupPromise;
		await expect(popup).toHaveURL(savedUrl.href);
		await expect(
			popup.getByRole('dialog', { name: 'Your Playgrounds pane' })
		).toBeVisible();
		// No remote.html means no PHP worker and no mount of this site's files.
		expect(
			popup
				.frames()
				.some(
					(frame) => new URL(frame.url()).pathname === '/remote.html'
				)
		).toBe(false);
		expect(
			await popup.evaluate(() =>
				(window as any).playgroundSites
					.list()
					.some((site: any) => site.isActive)
			)
		).toBe(false);
		await popup.reload();
		await expect(
			popup.getByRole('dialog', { name: 'Your Playgrounds pane' })
		).toBeVisible();
		expect(
			popup
				.frames()
				.some(
					(frame) => new URL(frame.url()).pathname === '/remote.html'
				)
		).toBe(false);

		// A stale HTTP address and the database popup wrapper cannot mount saved files either.
		const responses = await wordpress
			.locator('body')
			.evaluate(async (_body, url) => {
				return await Promise.all(
					['GET', 'POST'].map(async (method) => {
						try {
							return await (await fetch(url, { method })).text();
						} catch {
							return 'request failed';
						}
					})
				);
			}, probeUrl);
		for (const body of responses)
			expect(body).not.toContain('started saved PHP');
		const toolPopup = await context.newPage();
		await toolPopup.goto(
			new URL(
				`/wordpress-popup.html${savedUrl.searchParams.has('reprint') ? '?reprint' : ''}#${new URL(probeUrl).pathname}`,
				savedUrl
			).href
		);
		await expect(toolPopup.locator('#wp')).toHaveAttribute('src', probeUrl);
		expect(
			toolPopup
				.frames()
				.some(
					(frame) => new URL(frame.url()).pathname === '/remote.html'
				)
		).toBe(false);
		await toolPopup.close();

		await website.openSavedPlayground(popup);
		await popup.waitForFunction(
			() => !!(window as any).playgroundSites?.getClient()
		);
		const reopened = await popup.evaluate(async () => {
			const client = (window as any).playgroundSites.getClient();
			return {
				marker: await client.readFileAsText(
					'/wordpress/startup-marker.txt'
				),
				httpUrl: await client.absoluteUrl,
			};
		});
		expect(reopened.marker).toBe('not requested');
		// Keep saved WordPress links valid when the user reopens this site.
		expect(reopened.httpUrl).toBe(savedHttpUrl);
		await popup.close();

		// Choosing that same site in the app starts it directly, without a modal.
		await website.openPlaygroundsPane();
		await website.page
			.getByRole('button', {
				name: 'Open Saved startup test',
				exact: true,
			})
			.click();
		await website.waitForNestedIframes();
		await expect(website.page.getByRole('dialog')).not.toBeVisible();
		expect(
			await website.page.evaluate(async () => {
				const api = (window as any).playgroundSites;
				await api.isReady();
				return await api
					.getClient()
					.readFileAsText('/wordpress/startup-marker.txt');
			})
		).toBe('not requested');
	});
});

for (const mode of ['', 'seamless']) {
	for (const slug of ['guessable-name', '']) {
		test(`unknown saved-site URLs leave the list open without creating a site (${mode || 'normal'}, ${slug || 'empty'})`, async ({
			page,
		}) => {
			await page.goto(`/?site-slug=${slug}&storage=temp&mode=${mode}`);
			await expect(
				page.getByRole('dialog', { name: 'Your Playgrounds pane' })
			).toBeVisible();
			expect(
				await page.evaluate(() =>
					(window as any).playgroundSites.list()
				)
			).toEqual([]);
			expect(
				page
					.frames()
					.some(
						(frame) =>
							new URL(frame.url()).pathname === '/remote.html'
					)
			).toBe(false);
			await expect(
				page.getByRole('progressbar', {
					name: 'WordPress loading progress',
				})
			).not.toBeVisible();
		});
	}
}
