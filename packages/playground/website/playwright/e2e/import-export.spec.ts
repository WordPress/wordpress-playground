import { stat } from 'node:fs/promises';
import { test, expect } from '../playground-fixtures';
import type { WebsitePage } from '../website-page';

test('should export wp-content when Download as .zip is clicked', async ({
	website,
}, testInfo) => {
	await website.goto('./?storage=temp');
	await downloadZip(website, testInfo.outputPath('wordpress-playground.zip'));
});

test('should use the suggested username only in a hosting ZIP', async ({
	website,
	wordpress,
}, testInfo) => {
	await website.goto('./?storage=temp&url=/wp-admin/profile.php');
	const username = wordpress.getByRole('textbox', {
		name: 'Username',
		exact: true,
	});
	await expect(username).toHaveValue('admin');
	await website.openDockPane('Export');
	const options = website.page.getByRole('dialog', {
		name: 'Export pane',
		exact: true,
	});
	const hosting = options.getByRole('button', { name: 'Export for hosting' });
	await expect(hosting).toBeEnabled();
	await hosting.focus();
	await expect(hosting).toBeFocused();
	await hosting.press('Enter');
	const hostingPane = website.page.getByRole('dialog', {
		name: 'Export for hosting pane',
	});
	const back = hostingPane.getByRole('button', {
		name: 'Back to export options',
	});
	await expect(back).toBeFocused();
	await back.press('Enter');
	await expect(hosting).toBeFocused();

	await hosting.click();
	await website.ensureSiteManagerIsClosed();
	await website.openDockPane('Export');
	await expect(
		options.getByRole('button', { name: 'Download as .zip' })
	).toBeEnabled();
	await hosting.click();

	const input = hostingPane.getByRole('textbox', {
		name: 'Admin username in this ZIP',
	});
	await expect(input).toHaveValue(/^site-/);
	const suggested = await input.inputValue();
	await input.fill('Admin');
	const submit = hostingPane.getByRole('button', {
		name: 'Download hosting ZIP',
	});
	await submit.click();
	await expect(
		website.page.getByRole('alert').filter({ hasText: 'other than admin' })
	).toBeVisible();
	await input.fill(suggested);
	const downloadPromise = website.page.waitForEvent('download');
	await submit.click();
	const zipPath = testInfo.outputPath('hosting.zip');
	await (await downloadPromise).saveAs(zipPath);

	await website.ensureSiteManagerIsClosed();
	await expect(username).toHaveValue('admin');
	await website.openDockPane('New Playground');
	await website.page.getByRole('tab', { name: 'Import zip' }).click();
	await website.page
		.locator('input[type="file"][accept*=".zip"]')
		.setInputFiles(zipPath);
	await expect
		.poll(async () => {
			return await website.page.evaluate(async (login) => {
				const sites = (window as any).playgroundSites;
				await sites.isReady();
				const response = await sites.getClient().run({
					code: `<?php require '/wordpress/wp-load.php';
					echo (int) !is_wp_error(wp_authenticate(${JSON.stringify(login)}, 'password'));`,
				});
				return response.text;
			}, suggested);
		})
		.toBe('1');
	await expect(
		website.page
			.getByRole('navigation', { name: 'Playground tools' })
			.getByText(/^(Autosaved|Unsaved)$/)
	).toBeVisible();
});

// Importing a ZIP creates an autosaved site when browser storage is available.
test.describe('Playground ZIP import', { tag: '@storage' }, () => {
	test.describe.configure({ mode: 'default' });

	test('should restore a previously exported wp-content directory', async ({
		website,
		wordpress,
	}, testInfo) => {
		const siteTitle = 'Playwright tests – site title';
		const blueprint = { siteOptions: { blogname: siteTitle } };
		// Specify initial WP URL because the Playground has changed
		// its default WP URL in the past.
		await website.goto(
			`./?storage=temp&url=%2F#${JSON.stringify(blueprint)}`
		);
		await expect(wordpress.locator('body')).toContainText(siteTitle);

		const zipPath = testInfo.outputPath('wordpress-playground.zip');
		await downloadZip(website, zipPath);

		await website.goto('./?storage=temp&url=%2F');
		await expect(wordpress.locator('body')).not.toContainText(siteTitle);

		await website.openDockPane('New Playground');
		await website.page.getByRole('tab', { name: 'Import zip' }).click();
		await website.page
			.locator('input[type="file"][accept*=".zip"]')
			.setInputFiles(zipPath);

		await expect(wordpress.locator('body')).toContainText(siteTitle);
		// The imported page appears before the initial browser save finishes.
		// Wait for that save before closing the browser context. Browsers without
		// storage support keep the imported site in memory and show Unsaved.
		await expect(
			website.page
				.getByRole('navigation', { name: 'Playground tools' })
				.getByText(/^(Autosaved|Unsaved)$/)
		).toBeVisible();
	});
});

async function downloadZip(website: WebsitePage, zipPath: string) {
	await website.openDockPane('Export');
	const downloadPromise = website.page.waitForEvent('download');
	await website.page
		.getByRole('button', { name: 'Download as .zip' })
		.click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toBe('wordpress-playground.zip');
	await download.saveAs(zipPath);
	// Check the file on disk instead of copying the archive into the browser's heap.
	expect((await stat(zipPath)).size).toBeGreaterThan(1000);
}
