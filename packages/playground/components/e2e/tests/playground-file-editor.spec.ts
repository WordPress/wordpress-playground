import { expect, type Page, test } from '@playwright/test';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';

declare global {
	interface Window {
		__fileEditorHarness?: {
			filesystem: AsyncWritableFilesystem;
			readFileAsText: (path: string) => Promise<string>;
		};
	}
}

const initialPath = '/wordpress/workspace/index.php';

async function gotoHarness(page: Page) {
	await page.goto('/playwright-file-editor.html');
	await page.waitForFunction(() => Boolean(window.__fileEditorHarness));
	await expect(page.locator('.cm-content')).toBeVisible();
}

async function readHarnessFile(page: Page, path: string) {
	return page.evaluate((filePath) => {
		const harness = window.__fileEditorHarness;
		if (!harness) {
			throw new Error('File editor harness is not mounted');
		}
		return harness.readFileAsText(filePath);
	}, path);
}

test.beforeEach(async ({ page }) => {
	await gotoHarness(page);
});

test('opens the initial file', async ({ page }) => {
	await expect(page.getByText(initialPath)).toBeVisible();
	await expect(page.locator('.cm-content')).toContainText(
		"<?php echo 'Hello';"
	);
});

test('autosaves editor changes into the harness filesystem', async ({
	page,
}) => {
	const nextContent = "<?php echo 'Changed in harness';";
	const editor = page.locator('.cm-content');

	await editor.click();
	await page.keyboard.press('ControlOrMeta+A');
	await page.keyboard.insertText(nextContent);

	await expect
		.poll(() => readHarnessFile(page, initialPath), {
			timeout: 10_000,
		})
		.toBe(nextContent);
});
