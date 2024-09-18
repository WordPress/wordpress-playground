import { test, expect } from './playground-fixtures';

// We can't import the SupportedPHPVersions versions directly from the remote package
// because of ESModules vs CommonJS incompatibilities. Let's just import the
// JSON file directly. @ts-ignore
// eslint-disable-next-line @nx/enforce-module-boundaries
import { SupportedPHPVersions } from '../../../php-wasm/universal/src/lib/supported-php-versions.ts';

test('should reflect the URL update from the navigation bar in the WordPress site', async ({
	page,
	wordpressPage,
}) => {
	await page.goto('./?url=/wp-admin');

	const openSiteButton = page.locator('div[title="Open site"]');
	await expect(openSiteButton).toBeVisible();
	await openSiteButton.click();

	const inputElement = page.locator('input[value="/wp-admin/"]');
	await expect(inputElement).toBeVisible();
	await expect(inputElement).toHaveValue('/wp-admin/');
});

SupportedPHPVersions.forEach(async (version) => {
	test(`should switch PHP version to ${version}`, async ({ page }) => {
		/**
		 * WordPress 6.6 dropped support for PHP 7.0 and 7.1 so we need to skip these versions.
		 * @see https://make.wordpress.org/core/2024/04/08/dropping-support-for-php-7-1/
		 */
		if (['7.0', '7.1'].includes(version)) {
			return;
		}
		await page.goto(`./`);

		const editSettingsButton = page.locator('button.components-button', {
			hasText: 'Edit Playground settings',
		});
		await expect(editSettingsButton).toBeVisible();
		await editSettingsButton.click();

		const phpVersionSelect = page.locator('select[name=phpVersion]');
		await expect(phpVersionSelect).toBeVisible();
		await phpVersionSelect.selectOption(version);

		const saveSettingsButton = page.locator(
			'button.components-button.is-primary',
			{
				hasText: 'Update',
			}
		);
		await expect(saveSettingsButton).toBeVisible();
		await saveSettingsButton.click();

		const textContent = await page
			.locator('div.components-flex-item')
			.allTextContents();
		expect(textContent).toContain(`${version} (with extensions)`);
	});
});
