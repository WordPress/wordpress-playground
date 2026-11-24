import { expect, type Page, test } from '@playwright/test';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';

type FilesystemName = 'a' | 'b';

declare global {
	interface Window {
		__fileEditorHarness?: {
			filesystems: Record<FilesystemName, AsyncWritableFilesystem>;
			readFileAsText: (
				filesystem: FilesystemName,
				path: string
			) => Promise<string>;
			switchFilesystem: (filesystem: FilesystemName) => void;
			mountEditor: () => void;
			unmountEditor: () => void;
			delayNextWrite: () => void;
			releaseDelayedWrite: () => void;
			isWriteDelayed: () => boolean;
		};
	}
}

const initialPath = '/wordpress/workspace/index.php';

async function gotoHarness(page: Page) {
	await page.goto('/playwright-file-editor.html');
	await page.waitForFunction(() => Boolean(window.__fileEditorHarness));
	await expect(page.locator('.cm-content')).toBeVisible();
}

async function readHarnessFile(
	page: Page,
	path: string,
	filesystem: FilesystemName = 'a'
) {
	return page.evaluate(
		({ filePath, filesystemName }) => {
			const harness = window.__fileEditorHarness;
			if (!harness) {
				throw new Error('File editor harness is not mounted');
			}
			return harness.readFileAsText(filesystemName, filePath);
		},
		{ filePath: path, filesystemName: filesystem }
	);
}

/** Replaces the editor contents as one user edit. */
async function replaceEditorContents(page: Page, content: string) {
	const editor = page.locator('.cm-content');
	await editor.click();
	await page.keyboard.press('ControlOrMeta+A');
	await page.keyboard.insertText(content);
	await expect(page.getByText('Saving…')).toBeVisible();
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
	await replaceEditorContents(page, nextContent);

	await expect
		.poll(() => readHarnessFile(page, initialPath), {
			timeout: 10_000,
		})
		.toBe(nextContent);
});

test('flushes a pending edit when the editor unmounts', async ({ page }) => {
	const nextContent = "<?php echo 'Saved before unmount';";
	await replaceEditorContents(page, nextContent);

	await page.evaluate(() => {
		window.__fileEditorHarness?.unmountEditor();
	});
	await expect(page.locator('.cm-content')).toHaveCount(0);
	await expect
		.poll(() => readHarnessFile(page, initialPath))
		.toBe(nextContent);
});

test('keeps a pending edit with its old filesystem', async ({ page }) => {
	const filesystemAContent = "<?php echo 'Filesystem A edit';";
	const filesystemBContent = "<?php echo 'Filesystem B';";
	await replaceEditorContents(page, filesystemAContent);

	await page.evaluate(() => {
		window.__fileEditorHarness?.switchFilesystem('b');
	});

	await expect(page.locator('.cm-content')).toContainText(filesystemBContent);
	await expect
		.poll(() => readHarnessFile(page, initialPath, 'a'))
		.toBe(filesystemAContent);
	await expect(readHarnessFile(page, initialPath, 'b')).resolves.toBe(
		filesystemBContent
	);
});

test('orders old writes without blocking the new filesystem', async ({
	page,
}) => {
	const firstContent = "<?php echo 'First edit';";
	const finalContent = "<?php echo 'Final edit';";
	const filesystemBContent = "<?php echo 'Filesystem B';";
	const filesystemBEdit = "<?php echo 'Filesystem B edit';";

	await page.evaluate(() => {
		window.__fileEditorHarness?.delayNextWrite();
	});
	await replaceEditorContents(page, firstContent);
	await page.waitForFunction(
		() => window.__fileEditorHarness?.isWriteDelayed() === true
	);
	await replaceEditorContents(page, finalContent);

	await page.evaluate(() => {
		window.__fileEditorHarness?.switchFilesystem('b');
	});

	await expect(page.locator('.cm-content')).toContainText(filesystemBContent);
	await replaceEditorContents(page, filesystemBEdit);
	await expect
		.poll(() => readHarnessFile(page, initialPath, 'b'))
		.toBe(filesystemBEdit);

	await page.evaluate(() => {
		window.__fileEditorHarness?.releaseDelayedWrite();
	});
	await expect
		.poll(() => readHarnessFile(page, initialPath, 'a'))
		.toBe(finalContent);
});
