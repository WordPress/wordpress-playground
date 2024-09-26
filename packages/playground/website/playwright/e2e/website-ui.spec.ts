import { test, expect } from '../playground-fixtures.ts';
import { Blueprint } from '@wp-playground/blueprints';

// We can't import the SupportedPHPVersions versions directly from the remote package
// because of ESModules vs CommonJS incompatibilities. Let's just import the
// JSON file directly. @ts-ignore
// eslint-disable-next-line @nx/enforce-module-boundaries
import { SupportedPHPVersions } from '../../../../php-wasm/universal/src/lib/supported-php-versions.ts';
// eslint-disable-next-line @nx/enforce-module-boundaries
import * as MinifiedWordPressVersions from '../../../wordpress-builds/src/wordpress/wp-versions.json';

test('should reflect the URL update from the navigation bar in the WordPress site', async ({
	website,
}) => {
	await website.goto('./?url=/wp-admin');

	await website.expandSiteView();

	await expect(website.page.locator('input[value="/wp-admin/"]')).toHaveValue(
		'/wp-admin/'
	);
});

test('should switch between sites', async ({ website }) => {
	await website.goto('./');

	await website.openNewSiteModal();

	const newSiteName = await website.page
		.locator('input[placeholder="Playground name"]')
		.inputValue();

	await website.clickCreateInNewSiteModal();

	await expect(await website.getSiteTitle()).toMatch(newSiteName);

	const sidebarItem = website.page.locator(
		'.components-button[class*="_sidebar-item"]:not([class*="_sidebar-item--selected_"])'
	);
	const siteName = await sidebarItem
		.locator('.components-flex-item[class*="_sidebar-item--site-name"]')
		.innerText();
	await sidebarItem.click();

	await expect(siteName).toMatch(await website.getSiteTitle());
});

SupportedPHPVersions.forEach(async (version) => {
	test(`should switch PHP version to ${version}`, async ({ website }) => {
		/**
		 * WordPress 6.6 dropped support for PHP 7.0 and 7.1 so we need to skip these versions.
		 * @see https://make.wordpress.org/core/2024/04/08/dropping-support-for-php-7-1/
		 */
		if (['7.0', '7.1'].includes(version)) {
			return;
		}
		await website.goto(`./`);

		await website.openEditSettings();

		await website.selectPHPVersion(version);

		await website.clickSaveInEditSettings();

		expect(await website.getSiteInfoRowLocator('PHP version')).toHaveText(
			`${version} (with extensions)`
		);
	});

	test(`should not load additional PHP ${version} extensions when not requested`, async ({
		website,
	}) => {
		await website.goto('./');
		await website.openEditSettings();
		await website.selectPHPVersion(version);

		// Uncheck the "with extensions" checkbox
		const phpExtensionCheckbox = website.page.locator(
			'.components-checkbox-control__input[name="withExtensions"]'
		);
		await phpExtensionCheckbox.uncheck();

		await website.clickSaveInEditSettings();

		expect(await website.getSiteInfoRowLocator('PHP version')).toHaveText(
			version
		);
	});
});

Object.keys(MinifiedWordPressVersions)
	// WordPress beta versions are not supported in the UI
	.filter((version) => !['beta', 'default'].includes(version))
	.forEach(async (version) => {
		test(`should switch WordPress version to ${version}`, async ({
			website,
		}) => {
			await website.goto('./');
			await website.openEditSettings();
			await website.selectWordPressVersion(version);
			await website.clickSaveInEditSettings();

			expect(
				await website.getSiteInfoRowLocator('WordPress version')
			).toHaveText(version);
		});
	});

test('should display networking as inactive by default', async ({
	website,
}) => {
	await website.goto('./');

	await expect(await website.hasNetworkingEnabled()).toBeFalsy();
});

test('should display networking as active when networking is enabled', async ({
	website,
}) => {
	await website.goto('./?networking=yes');
	await expect(await website.hasNetworkingEnabled()).toBeTruthy();
});

test('should enable networking when requested', async ({ website }) => {
	await website.goto('./');

	await website.openEditSettings();
	await website.setNetworkingEnabled(true);
	await website.clickSaveInEditSettings();

	await expect(await website.hasNetworkingEnabled()).toBeTruthy();
});

test('should disable networking when requested', async ({ website }) => {
	await website.goto('./?networking=yes');

	await website.openEditSettings();
	await website.setNetworkingEnabled(false);
	await website.clickSaveInEditSettings();

	await expect(await website.hasNetworkingEnabled()).toBeFalsy();
});

test('should display PHP output even when a fatal error is hit', async ({
	website,
	wordpress,
}) => {
	const blueprint: Blueprint = {
		landingPage: '/err.php',
		login: true,
		steps: [
			{
				step: 'writeFile',
				path: '/wordpress/err.php',
				data: "<?php throw new Exception('This is a fatal error'); \n",
			},
		],
	};
	await website.goto(`./#${JSON.stringify(blueprint)}`);

	await expect(wordpress.locator('body')).toContainText(
		'This is a fatal error'
	);
});
