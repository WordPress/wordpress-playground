import { test } from '@playwright/test';
import { join } from 'node:path';
import { WebsitePage } from '../website-page';

/**
 * Regenerates the "Vanilla WordPress" preview shown as the first card in the
 * New Playground pane.
 *
 * That card is intentionally NOT a Blueprint in the WordPress/blueprints repo —
 * it starts a clean Playground — so its screenshot is kept in this package and
 * refreshed here instead of being maintained alongside Blueprint previews.
 *
 * Skipped by default so ordinary test runs never rewrite the committed asset.
 * To refresh it (locally, or from a scheduled CI job), run:
 *
 *   REGENERATE_SCREENSHOTS=1 npx playwright test \
 *     -c packages/playground/website/playwright/playwright.config.ts \
 *     --project=chromium -g "Vanilla WordPress preview"
 *
 * then commit the updated vanilla-wordpress.jpeg.
 */
const VANILLA_SCREENSHOT_PATH = join(
	__dirname,
	'..',
	'..',
	'src',
	'components',
	'saved-playgrounds-panel',
	'vanilla-wordpress.jpeg'
);

test('regenerate the Vanilla WordPress preview screenshot', async ({
	page,
}) => {
	test.skip(
		process.env.REGENERATE_SCREENSHOTS !== '1',
		'Set REGENERATE_SCREENSHOTS=1 to refresh the committed asset.'
	);

	const website = new WebsitePage(page);
	await page.setViewportSize({ width: 1440, height: 900 });
	// A temporary Playground boots straight into a clean vanilla WordPress.
	await website.goto('./?storage=temp');

	// Hide the floating dock so the capture shows only the WordPress homepage.
	await page.evaluate(() => {
		const dock = document.querySelector(
			'nav[aria-label="Playground tools"]'
		);
		if (dock instanceof HTMLElement) {
			dock.style.visibility = 'hidden';
		}
	});

	await page.screenshot({
		path: VANILLA_SCREENSHOT_PATH,
		type: 'jpeg',
		quality: 88,
	});
});
