import { test, expect } from '@playwright/test';
import { setWordPressUrl, wordPressFrame, wordPressIFrame } from './utils';

// @ts-ignore
// import * as SupportedWordPressVersions from '../../../remote/src/wordpress/wp-versions.json';

// const LatestSupportedWordPressVersion = Object.keys(
// 	SupportedWordPressVersions
// ).filter((x) => !['nightly', 'beta'].includes(x))[0];

test('WordPress navigation bar redirects the embedded WordPress to /wp-admin', async ({
	page,
}) => {
	await page.goto('/');
	await setWordPressUrl(page, '/wp-admin');

	// Check if wpIframe src is set to the correct URL
	const wpFrame = await wordPressIFrame(page);
	expect(await wpFrame.getAttribute('src')).toMatch(/\/wp-admin\/$/);
});

// Test all WordPress versions for completeness
const SupportedWordPressVersions = {
	// nightly: 'nightly',
	'6.4': '6.4',
	// '6.3': '6.3',
	// '6.2': '6.2',
	// '6.1': '6.1',
};
for (const version in SupportedWordPressVersions) {
	if (version === 'beta') {
		continue;
	}
	// @ts-ignore
	test('Switches WordPress version to ' + version, async ({ page }) => {
		await page.goto('/');
		await setWordPressUrl(page, '/wp-admin');
		// Update settings in Playground configurator
		const configurator = await page.waitForSelector('button#configurator');
		configurator.click();

		const wpVersionSelect = await page.waitForSelector('select#wp-version');
		await wpVersionSelect.selectOption(version);
		await page.click('#modal-content button[type=submit]');
		// Wait for the page to finish loading
		await page.waitForURL(new RegExp(`&wp=${version}`));

		// Go to wp-admin
		const wpFrame = await wordPressIFrame(page);
		if (version === 'nightly') {
			const footer = await wpFrame.waitForSelector('#footer-upgrade');
			expect(await footer.textContent()).toContain(
				'You are using a development version'
			);
		} else {
			await wpFrame.waitForSelector(
				'body.branch-' + version.replace('.', '-')
			);
		}
	});
}
