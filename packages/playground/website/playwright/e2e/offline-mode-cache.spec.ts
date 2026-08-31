import { test, expect } from '@playwright/test';

test('PHP 8.3 does not prefetch PHP next runtimes', async ({ page }) => {
	const blueprint = {
		preferredVersions: {
			php: '8.3',
			wp: 'latest',
		},
	};
	await page.goto(`./?storage=none#${JSON.stringify(blueprint)}`);
	test.skip(
		new URL(page.url()).pathname.startsWith('/website-server/'),
		'The offline asset manifest is generated only by production builds.'
	);

	const manifestResponse = await page.request.get(
		new URL('assets-required-for-offline-mode.json', page.url()).href
	);
	expect(manifestResponse.ok()).toBeTruthy();

	const requiredAssets = (await manifestResponse.json()) as string[];
	expect(requiredAssets).not.toEqual(
		expect.arrayContaining([expect.stringMatching(/^\/php-next\//)])
	);
});
