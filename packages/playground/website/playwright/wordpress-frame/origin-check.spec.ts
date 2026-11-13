import { test, expect } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import { joinPaths } from '@php-wasm/util';
import {
	appOrigin,
	wordPressOrigin,
} from '../../bin/wordpress-frame/origins.mjs';

// Contract: every published app entry stops on the sandbox before its code runs.
// Copied public HTML and retained release URLs bypass Vite's HTML entry pipeline
// and the PHP host gate, so exercise the actual installed files in each browser.
test('all app entries and the helper stop on the wrong origin', async ({
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
		const wrongOrigin =
			file === 'wordpress-bridge.html' ? appOrigin : wordPressOrigin;
		await page.goto(`${wrongOrigin}/releases/${release}/${file}`);
		await expect(
			page.getByText('This Playground page cannot run on this host.', {
				exact: true,
			}),
			file
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
});
