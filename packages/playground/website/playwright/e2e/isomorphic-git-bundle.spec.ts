import { test, expect, type Page } from '@playwright/test';

test('browser bundle should not include the isomorphic-git Node crypto path', async ({
	page,
}) => {
	await page.goto('./');

	const bundles = await fetchIsomorphicGitBundles(page);

	for (const bundle of bundles) {
		expect(bundle.source).not.toContain('createHash');
		expect(bundle.source).not.toContain('__vite-browser-external');

		if (bundle.sourceMap) {
			expect(bundle.sourceMap).not.toContain(
				'node_modules/isomorphic-git/index.cjs'
			);
			expect(bundle.sourceMap).not.toContain('browser-external:crypto');
		}
	}
});

async function fetchIsomorphicGitBundles(page: Page) {
	const productionBundles = await fetchProductionIsomorphicGitBundles(page);
	if (productionBundles) {
		return productionBundles;
	}
	return [await fetchDevIsomorphicGitBundle(page)];
}

async function fetchProductionIsomorphicGitBundles(page: Page) {
	const assetsResponse = await page.request.get(
		new URL('assets-required-for-offline-mode.json', page.url()).href
	);
	if (!assetsResponse.ok()) {
		return undefined;
	}

	const assetsText = await assetsResponse.text();
	if (!assetsText.trim().startsWith('[')) {
		return undefined;
	}

	const assets = JSON.parse(assetsText) as string[];
	const bundlePaths = assets.filter(
		(asset) =>
			asset.startsWith('/assets/isomorphic-git-internals-') &&
			asset.endsWith('.js')
	);
	expect(bundlePaths).not.toHaveLength(0);

	return await Promise.all(
		bundlePaths.map(async (bundlePath) => {
			const bundleUrl = new URL(bundlePath.replace(/^\//, ''), page.url())
				.href;
			return {
				source: await fetchText(page, bundleUrl),
				sourceMap: await fetchOptionalText(page, `${bundleUrl}.map`),
			};
		})
	);
}

async function fetchDevIsomorphicGitBundle(page: Page) {
	const bundleUrl = new URL(
		'node_modules/.vite/packages-playground-website/deps/isomorphic-git.js',
		page.url()
	).href;
	return {
		source: await fetchText(page, bundleUrl),
		sourceMap: await fetchOptionalText(page, `${bundleUrl}.map`),
	};
}

async function fetchText(page: Page, url: string) {
	const response = await page.request.get(url);
	expect(response.ok()).toBeTruthy();
	return await response.text();
}

async function fetchOptionalText(page: Page, url: string) {
	const response = await page.request.get(url);
	if (!response.ok()) {
		return undefined;
	}
	return await response.text();
}
