import { stat } from 'node:fs/promises';
import { test, expect } from '../playground-fixtures';
import type { WebsitePage } from '../website-page';

test('should export wp-content when Download as .zip is clicked', async ({
	website,
}, testInfo) => {
	await website.goto('./?storage=temp');
	await downloadZip(website, testInfo.outputPath('wordpress-playground.zip'));
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
