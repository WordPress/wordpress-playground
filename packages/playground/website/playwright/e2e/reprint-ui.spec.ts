import { test, expect } from '../playground-fixtures';

test(
	'cloning a site keeps the current Playground until the connection is submitted',
	{ tag: '@storage' },
	async ({ website, browserName }) => {
		test.skip(
			browserName !== 'chromium',
			'This flow requires browser storage.'
		);
		await website.goto('./?name=pull-entry-original');
		const page = website.page;
		await page.waitForFunction(() =>
			Boolean((window as any).playgroundSites?.getClient())
		);
		// The client is usable before its first background save has mounted OPFS.
		// Finish that save before writing and flushing the original site's marker.
		await expect(
			page.getByRole('button', { name: 'Autosaved' })
		).toBeVisible();
		const originalSlug = await page.evaluate(async () => {
			const api = (window as any).playgroundSites;
			const { slug } = await api.saveInBrowser();
			const client = api.getClient();
			await client.writeFile(
				'/wordpress/original-site.txt',
				'Keep this Playground'
			);
			await client.flushOpfs('/wordpress');
			return slug;
		});
		const activeSlug = () =>
			page.evaluate(
				() =>
					(window as any).playgroundSites
						.list()
						.find((site: any) => site.isActive).slug
			);
		await page
			.getByRole('button', { name: 'New Playground', exact: true })
			.click();
		await page.getByRole('button', { name: 'Clone a live site' }).click();
		const pane = page.getByRole('dialog', {
			name: 'Clone a WordPress site pane',
		});
		await expect(
			pane.getByRole('textbox', { name: 'Live site URL', exact: true })
		).toBeFocused();
		// Choosing the site and key must not touch the current Playground.
		expect(await activeSlug()).toBe(originalSlug);

		await pane
			.getByRole('textbox', { name: 'Live site URL', exact: true })
			.fill('http://127.0.0.1:1/');
		await pane.getByRole('button', { name: 'Check site' }).click();
		await pane
			.getByRole('button', { name: 'Reprint is installed — enter a key' })
			.click();
		await pane.locator('input[type=password]').fill('test-key');
		expect(await activeSlug()).toBe(originalSlug);
		await pane.getByRole('button', { name: 'Clone site' }).click();

		await page.waitForFunction(
			(slug) =>
				(window as any).playgroundSites
					.list()
					.find((site: any) => site.isActive)?.slug !== slug,
			originalSlug
		);
		// The new Playground boots after it becomes active.
		await page.waitForFunction(() => {
			try {
				return Boolean((window as any).playgroundSites?.getClient());
			} catch {
				return false;
			}
		});
		const destination = await page.evaluate(async () => {
			const api = (window as any).playgroundSites;
			return {
				site: api.list().find((site: any) => site.isActive),
				hasOriginalFile: await api
					.getClient()
					.fileExists('/wordpress/original-site.txt'),
			};
		});
		expect(destination.site.slug).not.toBe(originalSlug);
		// The clone stays temporary until the pull completes.
		expect(destination.site.storage).toBe('temporary');
		expect(destination.hasOriginalFile).toBe(false);
		// The new Playground picks up the connection and attempts the pull.
		await expect(
			page.getByRole('button', { name: 'Try resuming' })
		).toBeVisible({ timeout: 60_000 });

		await website.goto(`./?site-slug=${encodeURIComponent(originalSlug)}`);
		await page.waitForFunction(() =>
			Boolean((window as any).playgroundSites?.getClient())
		);
		expect(
			await page.evaluate(() =>
				(window as any).playgroundSites
					.getClient()
					.readFileAsText('/wordpress/original-site.txt')
			)
		).toBe('Keep this Playground');
	}
);
