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

/** Drops one nested host directory on the file explorer background. */
async function dropHarnessDirectory(page: Page, content: string) {
	await page
		.locator('[class*="fileExplorerContainer"]')
		.first()
		.evaluate((container, fileContent) => {
			const file = new File([fileContent], 'note.txt', {
				type: 'text/plain',
			});
			const fileEntry = {
				isFile: true,
				isDirectory: false,
				name: file.name,
				file: (resolve: (value: File) => void) => resolve(file),
			};
			let nestedRead = false;
			const nestedDirectory = {
				isFile: false,
				isDirectory: true,
				name: 'nested',
				createReader: () => ({
					readEntries: (resolve: (entries: unknown[]) => void) => {
						resolve(nestedRead ? [] : [fileEntry]);
						nestedRead = true;
					},
				}),
			};
			let rootRead = false;
			const droppedDirectory = {
				isFile: false,
				isDirectory: true,
				name: 'dropped-folder',
				createReader: () => ({
					readEntries: (resolve: (entries: unknown[]) => void) => {
						resolve(rootRead ? [] : [nestedDirectory]);
						rootRead = true;
					},
				}),
			};
			let dropDataIsReadable = true;
			const dropEvent = new Event('drop', {
				bubbles: true,
				cancelable: true,
			});
			Object.defineProperty(dropEvent, 'dataTransfer', {
				value: {
					types: ['Files'],
					items: [
						{
							kind: 'file',
							webkitGetAsEntry: () =>
								dropDataIsReadable ? droppedDirectory : null,
						},
					],
					files: [],
				},
			});
			container.dispatchEvent(dropEvent);
			dropDataIsReadable = false;
		}, content);
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

test('imports a local directory dropped on the explorer background', async ({
	page,
}) => {
	const content = 'Dropped from a nested local directory';
	const importedPath = '/wordpress/workspace/dropped-folder/nested/note.txt';

	await expect(
		page.getByRole('button', { name: 'Upload files' })
	).toBeVisible();
	await dropHarnessDirectory(page, content);

	await expect
		.poll(async () => {
			try {
				return await readHarnessFile(page, importedPath);
			} catch {
				return null;
			}
		})
		.toBe(content);
	await expect(
		page.locator('button[data-path="/wordpress/workspace/dropped-folder"]')
	).toBeVisible();
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
