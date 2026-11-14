import { test, expect } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import { joinPaths } from '@php-wasm/util';
import {
	appOrigin,
	wordPressOrigin,
} from '../../bin/wordpress-frame/origins.mjs';

// Contract: every published app entry stops on the sandbox before its code runs, and
// app entries also stop at retained release paths, which keep serving assets to
// open tabs but must not keep old pages usable. Copied public HTML and release URLs
// bypass Vite's HTML entry pipeline and the PHP host gate, so exercise the actual
// installed files in each browser.
test('app entries and the helper stop on the wrong origin or release path', async ({
	page,
}) => {
	const webRoot = joinPaths(
		__dirname,
		'../../../../../dist/packages/playground/wordpress-frame-public'
	);
	const { release } = JSON.parse(
		await readFile(joinPaths(webRoot, 'release.json'), 'utf8')
	);
	for (const file of await readdir(joinPaths(webRoot, 'releases', release), {
		recursive: true,
	})) {
		if (!/\.html?$/i.test(file) || /^wp-[^/]+\//.test(file)) continue;
		const isHelper = file === 'wordpress-bridge.html';
		// Old tabs load the helper by its release path, so only its origin is fixed.
		const origins = isHelper ? [appOrigin] : [wordPressOrigin, appOrigin];
		for (const origin of origins) {
			await page.goto(`${origin}/releases/${release}/${file}`);
			await expect(
				page.getByText(
					'This Playground page cannot run at this address.',
					{ exact: true }
				),
				`${origin} ${file}`
			).toBeVisible();
			expect(
				await page.evaluate(() =>
					Boolean(
						(window as any).playground ||
						(window as any).playgroundSites
					)
				)
			).toBe(false);
		}
	}
});
