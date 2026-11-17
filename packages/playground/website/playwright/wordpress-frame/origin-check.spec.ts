import { test, expect } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import { joinPaths } from '@php-wasm/util';
import {
	appOrigin,
	wordPressOrigin,
} from '../../bin/wordpress-frame/origins.mjs';

// build.mjs assembles remote, website, website-extras, and client outputs with
// assembleWebsite(), then installs that full upload here using apply-update.sh.
// The release directory holds every published static file; rootFiles lists the
// entry copies. WordPress's wp-* documents have a separate parsed-document scan.
// Contract: every published app entry stops on the sandbox before its code runs, and
// app entries also stop at retained release paths, which keep serving assets to
// open tabs but must not keep old pages usable. Copied public HTML and release URLs
// bypass Vite's HTML entry pipeline and the PHP host gate, so exercise the actual
// installed files in each browser.
test('app entries and the WordPress bridge stop on the wrong origin or release path', async ({
	page,
}) => {
	const webRoot = joinPaths(
		__dirname,
		'../../../../../dist/packages/playground/website-preview'
	);
	const { release, rootFiles } = JSON.parse(
		await readFile(joinPaths(webRoot, 'release.json'), 'utf8')
	);
	const pages = await readdir(joinPaths(webRoot, 'releases', release), {
		recursive: true,
	});
	for (const file of pages) {
		if (!/\.html?$/i.test(file) || /^wp-[^/]+\//.test(file)) continue;
		const isBridge = file === 'wordpress-bridge.html';
		// Old tabs load the bridge by its release path, so only its origin is fixed.
		const origins = isBridge ? [appOrigin] : [wordPressOrigin, appOrigin];
		const urls = origins.map(
			(origin) => `${origin}/releases/${release}/${file}`
		);
		// Also check the actual root copies. At the root, only the origin check
		// can stop these pages; the release-path check cannot hide a missing one.
		if (rootFiles.includes(file)) {
			urls.push(`${isBridge ? appOrigin : wordPressOrigin}/${file}`);
		}
		for (const url of urls) {
			await page.goto(url);
			await expect(
				page.getByText(
					'This Playground page cannot run at this address.',
					{ exact: true }
				),
				url
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
