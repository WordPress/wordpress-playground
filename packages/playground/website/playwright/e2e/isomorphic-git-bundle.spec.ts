import { test, expect, type Page } from '@playwright/test';

test('browser bundle should not include the isomorphic-git Node crypto path', async ({
	page,
}) => {
	await page.goto('./');

	const bundle = await fetchIsomorphicGitBundle(page);

	expect(bundle.source).not.toContain('createHash');
	expect(bundle.source).not.toContain('__vite-browser-external');

	if (bundle.sourceMap) {
		expect(bundle.sourceMap).not.toContain(
			'node_modules/isomorphic-git/index.cjs'
		);
		expect(bundle.sourceMap).not.toContain('browser-external:crypto');
	}
});

async function fetchIsomorphicGitBundle(page: Page) {
	const productionBundle = await fetchProductionIsomorphicGitBundle(page);
	if (productionBundle) {
		return productionBundle;
	}
	return await fetchDevIsomorphicGitBundle(page);
}

async function fetchProductionIsomorphicGitBundle(page: Page) {
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
	const bundlePath = assets.find(
		(asset) =>
			asset.startsWith('/assets/isomorphic-git-internals-') &&
			asset.endsWith('.js')
	);
	expect(bundlePath).toBeTruthy();

	const bundleUrl = new URL(bundlePath!.replace(/^\//, ''), page.url()).href;
	return {
		source: await fetchText(page, bundleUrl),
		sourceMap: await fetchOptionalText(page, `${bundleUrl}.map`),
	};
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
