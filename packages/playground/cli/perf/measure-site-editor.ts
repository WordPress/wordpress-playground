/**
 * Site editor performance measurement module.
 *
 * Adapted from Automattic/studio's
 * tools/benchmark-site-editor/measure-site-editor.ts.
 *
 * Runs a single benchmark pass against a Playground CLI WordPress
 * site: launches Chromium, navigates through the site editor, and
 * returns raw timing values for each metric.
 */

import { chromium } from '@playwright/test';
import type { Page, Frame } from '@playwright/test';

export const METRIC_NAMES = [
	'siteEditorLoad',
	'templatesViewLoad',
	'templateOpen',
	'blockAdd',
	'templateSave',
] as const;

export type MetricName = (typeof METRIC_NAMES)[number];

/** One timing value per metric. A metric may be missing if that
 *  step failed. */
export type MeasurementResult = Partial<Record<MetricName, number>>;

export interface MeasureOptions {
	/** Base URL of the Playground CLI WordPress site. */
	url: string;
	/** Launch browser in headed mode for debugging. */
	headed?: boolean;
}

/**
 * Runs a single benchmark measurement pass against a Playground CLI
 * site.
 *
 * Launches a fresh Chromium browser, navigates to the site editor,
 * performs the measurement steps, and returns timing results.  The
 * browser is always closed, even on error.
 */
export async function measureSiteEditor(
	options: MeasureOptions
): Promise<MeasurementResult> {
	let wpAdminUrl = options.url;
	if (!wpAdminUrl.startsWith('http')) {
		wpAdminUrl = `http://${wpAdminUrl}`;
	}
	wpAdminUrl = wpAdminUrl.replace(/\/$/, '');

	const result: MeasurementResult = {};

	const browser = await chromium.launch({
		headless: !options.headed,
	});
	const context = await browser.newContext();
	const page = await context.newPage();

	try {
		// Playground CLI auto-logs in as admin
		await page.goto(`${wpAdminUrl}/wp-admin`, {
			waitUntil: 'domcontentloaded',
			timeout: 120_000,
		});
		await page
			.waitForLoadState('networkidle', { timeout: 30_000 })
			.catch(() => {});
		await page.getByRole('link', { name: 'Appearance' }).waitFor({
			state: 'visible',
			timeout: 60_000,
		});

		// Step 1: Navigate to site editor
		const siteEditorStart = Date.now();

		await page.getByRole('link', { name: 'Appearance' }).click();
		await page.locator('a[href="site-editor.php"]').click();

		await dismissWelcomeModal(page);

		await page.locator('iframe[name="editor-canvas"]').waitFor({
			state: 'visible',
			timeout: 120_000,
		});

		const frame = await findEditorCanvasFrame(page);
		if (!frame) {
			throw new Error('Editor canvas frame not found');
		}

		await waitForBlocksRendered(frame);
		result.siteEditorLoad = Date.now() - siteEditorStart;

		// Step 2: Navigate to Templates view
		const templatesViewStart = Date.now();

		await page.getByRole('button', { name: 'Templates' }).click();
		await page
			.getByRole('heading', { name: 'Templates', level: 2 })
			.waitFor({ timeout: 60_000 });
		await page
			.locator('.dataviews-view-grid-items.dataviews-view-grid')
			.waitFor({ timeout: 60_000 });
		const firstCard = page.locator('.dataviews-view-grid__card').first();
		await firstCard.waitFor({
			state: 'visible',
			timeout: 60_000,
		});
		await firstCard
			.getByRole('button')
			.first()
			.waitFor({ state: 'visible', timeout: 60_000 });

		result.templatesViewLoad = Date.now() - templatesViewStart;

		// Step 3: Open a template
		const templateOpenStart = Date.now();

		await page
			.locator('.dataviews-view-grid__card')
			.first()
			.getByRole('button')
			.first()
			.click();
		await page.locator('iframe[name="editor-canvas"]').waitFor({
			state: 'visible',
			timeout: 60_000,
		});

		const templateFrame = await findEditorCanvasFrame(page);
		if (!templateFrame) {
			throw new Error('Template editor frame not found');
		}

		await waitForBlocksRendered(templateFrame);
		result.templateOpen = Date.now() - templateOpenStart;

		// Step 4: Add blocks
		const blockAddStart = Date.now();

		await page.keyboard.press('Escape');
		await page.getByRole('button', { name: /Block Inserter/i }).click();

		const searchInput = page.getByPlaceholder('Search');
		await searchInput.fill('Paragraph');
		await page
			.getByRole('option', { name: 'Paragraph', exact: true })
			.click();
		await templateFrame.waitForSelector('p[data-block]', {
			timeout: 15_000,
		});

		await searchInput.fill('Heading');
		await page
			.locator('.block-editor-block-types-list__item')
			.filter({ hasText: /^Heading$/ })
			.click();
		await templateFrame.waitForSelector(
			'h1[data-block], h2[data-block], h3[data-block]',
			{ timeout: 15_000 }
		);

		result.blockAdd = Date.now() - blockAddStart;

		// Step 5: Save the template
		const templateSaveStart = Date.now();

		const saveButton = page.getByRole('button', {
			name: 'Save',
			exact: true,
		});
		await saveButton.click();
		await saveButton.waitFor({ state: 'visible', timeout: 30_000 });
		await page.waitForFunction(
			(btn) => btn?.getAttribute('aria-disabled') === 'true',
			await saveButton.elementHandle(),
			{ timeout: 30_000 }
		);

		result.templateSave = Date.now() - templateSaveStart;
	} finally {
		await page.close();
		await context.close();
		await browser.close();
	}

	return result;
}

async function findEditorCanvasFrame(
	page: Page,
	timeoutMs = 30_000
): Promise<Frame | null> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		const frame = page.frame({ name: 'editor-canvas' });
		if (frame) {
			return frame;
		}
		await page.waitForTimeout(200);
	}
	return null;
}

async function dismissWelcomeModal(page: Page): Promise<void> {
	const welcomeDialog = page.getByRole('dialog', {
		name: /welcome to the site editor/i,
	});
	const isVisible = await welcomeDialog
		.isVisible({ timeout: 5_000 })
		.catch(() => false);
	if (isVisible) {
		await page.getByRole('button', { name: /get started/i }).click();
		await welcomeDialog
			.waitFor({ state: 'hidden', timeout: 5_000 })
			.catch(() => {});
	}
}

async function waitForBlocksRendered(frame: Frame): Promise<void> {
	await frame.waitForLoadState('domcontentloaded');
	await frame.waitForSelector('[data-block]', { timeout: 60_000 });
	await frame.waitForFunction(
		() => {
			const blocks = document.querySelectorAll('[data-block]');
			return (
				blocks.length > 0 &&
				Array.from(blocks).some((block) => block.clientHeight > 0)
			);
		},
		{ timeout: 60_000 }
	);
}
