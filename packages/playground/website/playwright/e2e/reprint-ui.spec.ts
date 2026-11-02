import { test, expect } from '../playground-fixtures';

test(
	'cloning a site keeps the current Playground until the connection is submitted',
	{ tag: '@storage' },
	async ({ website, browserName }) => {
		test.skip(
			browserName !== 'chromium',
			'This flow requires browser storage.'
		);
		await website.goto('./?reprint&name=pull-entry-original');
		const page = website.page;
		await page.context().grantPermissions(['clipboard-write']);
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
		/** Read the current selection independently of the transfer panel. */
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
		await pane.getByRole('button', { name: 'Connect manually' }).click();
		await expect(
			pane.getByRole('button', {
				name: 'Copy migration key',
				exact: true,
			})
		).toBeVisible();
		await pane
			.getByRole('button', { name: 'Copy migration key', exact: true })
			.click();
		await expect(
			pane.getByRole('button', {
				name: 'Copy migration key',
				exact: true,
			})
		).toBeFocused();
		const settingsOpened = page.context().waitForEvent('page');
		await pane
			.getByRole('link', { name: 'Open Reprint settings ↗', exact: true })
			.click();
		await (await settingsOpened).close();
		await expect(
			pane.getByRole('link', {
				name: 'Open Reprint settings ↗',
				exact: true,
			})
		).toBeFocused();
		await pane
			.locator('summary')
			.filter({ hasText: 'Show key and connection details' })
			.click();
		await expect(
			pane.getByRole('textbox', { name: 'Migration key', exact: true })
		).toHaveValue(/^[A-Za-z0-9+/]+=*$/);
		expect(await activeSlug()).toBe(originalSlug);
		await pane
			.getByRole('button', { name: 'I’ve authorized it — clone site' })
			.click();

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
		await expect(pane.getByRole('alert')).toBeVisible({ timeout: 60_000 });

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

for (const motion of ['animated', 'reduced-motion', 'unsupported', 'skipped']) {
	test(`entering and leaving the clone form keeps its temporary Playground (${motion})`, async ({
		website,
	}) => {
		const page = website.page;
		await page.emulateMedia({
			reducedMotion:
				motion === 'reduced-motion' ? 'reduce' : 'no-preference',
		});
		if (motion === 'unsupported' || motion === 'skipped') {
			await page.addInitScript((mode) => {
				const api = document as any;
				const start = api.startViewTransition?.bind(document);
				api.startViewTransition =
					mode === 'unsupported' || !start
						? undefined
						: (update: () => void) => {
								const transition = start(update);
								transition.skipTransition();
								return transition;
							};
			}, motion);
		}
		await website.goto('./?reprint&storage=temp&overlay=new');
		await page.waitForFunction(() =>
			Boolean((window as any).playgroundSites?.getClient())
		);
		const originalSlug = await page.evaluate(async () => {
			const api = (window as any).playgroundSites;
			await api
				.getClient()
				.writeFile(
					'/wordpress/clone-source-marker.txt',
					'Keep this site'
				);
			return api.list().find((site: any) => site.isActive).slug;
		});

		await page.getByRole('button', { name: 'Clone a live site' }).click();
		const pane = page.getByRole('dialog', {
			name: 'Clone a WordPress site pane',
		});
		await expect(
			pane.getByRole('textbox', { name: 'Live site URL' })
		).toBeFocused();
		// Temporary snapshot names must be released even when the browser skips the animation.
		await expect(page.locator('html')).not.toHaveAttribute(
			'data-clone-transition',
			/.*/
		);
		await expect(pane).not.toHaveAttribute('data-clone-transition', /.*/);
		await expect(page).not.toHaveURL(/[?&]overlay=/);
		await pane
			.getByRole('button', { name: 'Back to New Playground' })
			.click();
		const launcher = page.getByRole('button', {
			name: 'Clone a live site',
		});
		await expect(launcher).toBeFocused();
		await expect(page.locator('html')).not.toHaveAttribute(
			'data-clone-transition',
			/.*/
		);
		await expect(
			page.getByRole('dialog', { name: 'New Playground pane' })
		).not.toHaveAttribute('data-clone-transition', /.*/);
		// Back returns to the launcher, so Enter can open another fresh clone form.
		await launcher.press('Enter');
		await expect(
			pane.getByRole('textbox', { name: 'Live site URL' })
		).toBeFocused();
		// Keyboard Back can interrupt the entry motion before it finishes.
		await pane
			.getByRole('button', { name: 'Back to New Playground' })
			.press('Enter');
		await expect(launcher).toBeFocused();
		await expect(page.locator('html')).not.toHaveAttribute(
			'data-clone-transition',
			/.*/
		);
		const current = await page.evaluate(async () => {
			const api = (window as any).playgroundSites;
			return {
				slug: api.list().find((site: any) => site.isActive).slug,
				marker: await api
					.getClient()
					.readFileAsText('/wordpress/clone-source-marker.txt'),
			};
		});
		expect(current).toEqual({
			slug: originalSlug,
			marker: 'Keep this site',
		});
	});
}
