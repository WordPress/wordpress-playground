import { test, expect } from '../playground-fixtures.ts';
import {
	clickCreateInNewSiteModal,
	clickSaveInEditSettings,
	expandSiteView,
	getSiteInfoRowValue,
	getSiteTitle,
	hasNetworkingEnabled,
	openEditSettings,
	openNewSiteModal,
	selectPHPVersion,
	selectWordPressVersion,
	setNetworkingEnabled,
} from './website-helpers.ts';
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

	await expandSiteView(website);

	const inputElement = website.locator('input[value="/wp-admin/"]');
	await expect(inputElement).toBeVisible();
	await expect(inputElement).toHaveValue('/wp-admin/');
});

test('should switch between sites', async ({ website }) => {
	await website.goto('./');

	await openNewSiteModal(website);

	const newSiteName = await website
		.locator('input[placeholder="Playground name"]')
		.inputValue();

	await clickCreateInNewSiteModal(website);

	await expect(await getSiteTitle(website)).toMatch(newSiteName);

	const sidebarItem = website.locator(
		'.components-button[class*="_sidebar-item"]:not([class*="_sidebar-item--selected_"])'
	);
	const siteName = await sidebarItem
		.locator('.components-flex-item[class*="_sidebar-item--site-name"]')
		.innerText();
	await sidebarItem.isVisible();
	await sidebarItem.click();

	await expect(await getSiteTitle(website)).toMatch(siteName);
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

		await openEditSettings(website);

		await selectPHPVersion(website, version);

		await clickSaveInEditSettings(website);

		expect(await getSiteInfoRowValue(website, 'PHP version')).toMatch(
			`${version} (with extensions)`
		);
	});

	test(`should not load additional PHP ${version} extensions when not requested`, async ({
		website,
	}) => {
		await website.goto('./');
		await openEditSettings(website);
		await selectPHPVersion(website, version);

		// Uncheck the "with extensions" checkbox
		const phpExtensionCheckbox = website.locator(
			'.components-checkbox-control__input[name="withExtensions"]'
		);
		await expect(phpExtensionCheckbox).toBeVisible();
		await phpExtensionCheckbox.uncheck();

		await clickSaveInEditSettings(website);

		expect(await getSiteInfoRowValue(website, 'PHP version')).toMatch(
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
			await openEditSettings(website);
			await selectWordPressVersion(website, version);
			await clickSaveInEditSettings(website);

			expect(
				await getSiteInfoRowValue(website, 'WordPress version')
			).toMatch(version);
		});
	});

test('should display networking as inactive by default', async ({
	website,
}) => {
	await website.goto('./');

	await expect(await hasNetworkingEnabled(website)).toBeFalsy();
});

test('should display networking as active when networking is enabled', async ({
	website,
}) => {
	await website.goto('./?networking=yes');
	await expect(await hasNetworkingEnabled(website)).toBeTruthy();
});

test('should enable networking when requested', async ({ website }) => {
	await website.goto('./');

	await openEditSettings(website);
	await setNetworkingEnabled(website, true);
	await clickSaveInEditSettings(website);

	await expect(await hasNetworkingEnabled(website)).toBeTruthy();
});

test('should disable networking when requested', async ({ website }) => {
	await website.goto('./?networking=yes');

	await openEditSettings(website);
	await setNetworkingEnabled(website, false);
	await clickSaveInEditSettings(website);

	await expect(await hasNetworkingEnabled(website)).toBeFalsy();
});

test('should display PHP output even when a fatal error is hit', async ({
	website,
	wordpress,
}) => {
	const blueprint: Blueprint = {
		landingwebsite: '/err.php',
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
