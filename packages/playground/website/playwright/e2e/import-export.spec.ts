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

	test('should restore an exported site with a renamed administrator', async ({
		website,
		wordpress,
	}, testInfo) => {
		const siteTitle = 'Playwright tests – site title';
		const blueprint = { siteOptions: { blogname: siteTitle } };
		await website.goto(
			`./?storage=temp&url=/wp-admin/profile.php#${JSON.stringify(blueprint)}`
		);
		const login = wordpress.getByRole('textbox', {
			name: 'Username',
			exact: true,
		});
		const newLogin = wordpress.getByRole('textbox', {
			name: 'New username',
		});
		const updateProfile = wordpress.getByRole('button', {
			name: 'Update Profile',
		});
		await expect(login).toHaveValue('admin');

		const originalAccount = await getAdminAccount(website, 'admin');
		expect(originalAccount).toMatchObject({
			roles: ['administrator'],
		});
		await website.page.evaluate(async () => {
			await (window as any).playgroundSites.getClient().run({
				code: `<?php require '/wordpress/wp-load.php';
					wp_insert_user(['user_login' => 'taken-name', 'user_pass' => 'test-password']);`,
			});
		});
		await newLogin.fill('taken-name');
		await updateProfile.click();
		await expect(
			wordpress.getByText('That username is already in use.')
		).toBeVisible();
		await expect(login).toHaveValue('admin');

		await newLogin.fill('site-maintainer');
		await updateProfile.click();
		await expect(login).toHaveValue('site-maintainer');
		expect(await getAdminAccount(website, 'admin')).toBeNull();
		expect(await getAdminAccount(website, 'site-maintainer')).toEqual(
			originalAccount
		);

		const zipPath = testInfo.outputPath('wordpress-playground.zip');
		await downloadZip(website, zipPath);

		// Specify the front page because Playground's default URL has changed.
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
		expect(await getAdminAccount(website, 'admin')).toBeNull();
		expect(await getAdminAccount(website, 'site-maintainer')).toEqual(
			originalAccount
		);
	});
});

/** Authenticates with the original password and reads the fields a rename must preserve. */
async function getAdminAccount(website: WebsitePage, username: string) {
	return website.page.evaluate(async (username) => {
		const sites = (window as any).playgroundSites;
		await sites.isReady();
		const response = await sites.getClient().run({
			code: `<?php require '/wordpress/wp-load.php';
				$user = wp_authenticate(${JSON.stringify(username)}, 'password');
				echo wp_json_encode(is_wp_error($user) ? null : [
					'id' => $user->ID,
					'roles' => $user->roles,
					'authorSlug' => $user->user_nicename,
					'postAuthor' => get_post_field('post_author', 1),
				]);`,
		});
		return JSON.parse(response.text);
	}, username);
}

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
