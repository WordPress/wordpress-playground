import { test, expect } from '../playground-fixtures.ts';
import {
	clickCreateInNewSiteModal,
	clickSaveInEditSettings,
	expandSiteView,
	getSiteTitle,
	openEditSettings,
	openNewSiteModal,
	selectPHPVersion,
	validatePHPVersion,
} from './website-helpers.ts';

// We can't import the SupportedPHPVersions versions directly from the remote package
// because of ESModules vs CommonJS incompatibilities. Let's just import the
// JSON file directly. @ts-ignore
// eslint-disable-next-line @nx/enforce-module-boundaries
import { SupportedPHPVersions } from '../../../../php-wasm/universal/src/lib/supported-php-versions.ts';
// eslint-disable-next-line @nx/enforce-module-boundaries
import * as MinifiedWordPressVersions from '../../../wordpress-builds/src/wordpress/wp-versions.json';

test('should reflect the URL update from the navigation bar in the WordPress site', async ({
	page,
}) => {
	await page.goto('./?url=/wp-admin');

	await expandSiteView(page);

	const inputElement = page.locator('input[value="/wp-admin/"]');
	await expect(inputElement).toBeVisible();
	await expect(inputElement).toHaveValue('/wp-admin/');
});

test('should switch between sites', async ({ page }) => {
	await page.goto('./');

	await openNewSiteModal(page);

	const newSiteName = await page
		.locator('input[placeholder="Playground name"]')
		.inputValue();

	await clickCreateInNewSiteModal(page);

	await expect(await getSiteTitle(page)).toMatch(newSiteName);

	const sidebarItem = page.locator(
		'.components-button[class*="_sidebar-item"]:not([class*="_sidebar-item--selected_"])'
	);
	const siteName = await sidebarItem
		.locator('.components-flex-item[class*="_sidebar-item--site-name"]')
		.innerText();
	await sidebarItem.isVisible();
	await sidebarItem.click();

	await expect(await getSiteTitle(page)).toMatch(siteName);
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

		await openEditSettings(page);

		await selectPHPVersion(page, version);

		await clickSaveInEditSettings(page);

		await validatePHPVersion(page, `${version} (with extensions)`);
	});

	test(`should not load additional PHP ${version} extensions when not requested`, async ({
		page,
	}) => {
		await page.goto('./');
		await openEditSettings(page);

		await selectPHPVersion(page, version);

		const phpExtensionCheckbox = page.locator(
			'.components-checkbox-control__input[name="withExtensions"]'
		);
		await expect(phpExtensionCheckbox).toBeVisible();
		await phpExtensionCheckbox.click();

		await clickSaveInEditSettings(page);

		await validatePHPVersion(page, version);
	});
});

Object.keys(MinifiedWordPressVersions).forEach(async (version) => {
	test(`should switch WordPress version to ${version}`, async ({ page }) => {
		await page.goto('./');
	});
});
