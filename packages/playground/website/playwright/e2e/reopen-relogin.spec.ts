import type { Blueprint } from '@wp-playground/blueprints';
import type { Page } from '@playwright/test';
import { test, expect } from '../playground-fixtures';
import { getDirectoryNameForSlug } from '../../src/lib/state/opfs/opfs-site-path';

test('reopening a browser-stored Playground keeps auto-login enabled', async ({
	website,
	wordpress,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	const blueprint: Blueprint = {
		landingPage: '/wp-admin/',
		login: true,
	};
	await website.goto(`./#${encodeURIComponent(JSON.stringify(blueprint))}`);
	await expect(
		wordpress.getByRole('heading', { name: 'Dashboard', level: 1 })
	).toBeVisible();

	const firstSite = await website.page.evaluate(() => {
		const api = (window as any).playgroundSites;
		const activeSite = api.list().find((site: any) => site.isActive);
		(window as any).__firstPlaygroundClient = api.getClient();
		return activeSite;
	});
	expect(firstSite.storage).toBe('opfs');

	// Wait until the first runtime has finished writing the files and metadata
	// that the next runtime will restore.
	await expect
		.poll(async () => {
			const metadata = await readStoredSiteMetadata(
				website.page,
				firstSite.slug
			);
			return metadata.initialOpfsSyncPending;
		})
		.toBe(false);

	await website.page.evaluate(async (firstSiteSlug) => {
		const api = (window as any).playgroundSites;
		await api.createNewTemporarySite('reopen-relogin-second');
		await api.setActiveSite(firstSiteSlug, { updateUrl: false });
	}, firstSite.slug);

	const result = await website.page.evaluate(async () => {
		const api = (window as any).playgroundSites;
		return {
			sameClient:
				api.getClient() === (window as any).__firstPlaygroundClient,
			wpAdminStatus: (
				await api.getClient().request({ url: '/wp-admin/' })
			).httpStatusCode,
		};
	});
	expect(result.sameClient).toBe(false);
	expect(result.wpAdminStatus).toBe(200);
	await expect(wordpress.locator('body.logged-in')).toBeVisible();
});

async function readStoredSiteMetadata(page: Page, slug: string) {
	return await page.evaluate(async (siteDirectoryName) => {
		const root = await navigator.storage.getDirectory();
		const sites = await root.getDirectoryHandle('sites');
		const site = await sites.getDirectoryHandle(siteDirectoryName);
		const metadata = await site.getFileHandle('wp-runtime.json');
		return JSON.parse(await (await metadata.getFile()).text());
	}, getDirectoryNameForSlug(slug));
}
