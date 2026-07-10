import { expect, type Page, test } from '@playwright/test';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import { dirname } from '@php-wasm/util';
import { Buffer } from 'node:buffer';

declare global {
	interface Window {
		__fileEditorHarness?: {
			filesystem: AsyncWritableFilesystem;
			/** Reads one file from either synthetic filesystem. */
			readFileAsText: (
				path: string,
				filesystemIndex?: number
			) => Promise<string>;
			/** Replaces the editor without replacing its persisted identity. */
			remount: () => void;
			/** Selects an exact persisted identity for the mounted editor. */
			setPersistKey: (key: string | undefined) => void;
			/** Replaces the editor root and the path opened within it. */
			setDocumentRoot: (root: string, initialPath: string) => void;
			/** Removes one file from the active synthetic filesystem. */
			deleteFile: (path: string) => Promise<void>;
			/** Switches to the other synthetic filesystem. */
			switchFilesystem: () => void;
			/** Temporarily removes the filesystem from the mounted editor. */
			disconnectFilesystem: () => void;
			/** Restores the current filesystem to the mounted editor. */
			reconnectFilesystem: () => void;
			/** Makes the next write to this filesystem fail once. */
			failCurrentFilesystemWrites: () => void;
			/** Holds filesystem writes until releaseDelayedWrites is called. */
			delayCurrentFilesystemWrites: () => void;
			/** Resolves after a delayed write reaches the filesystem. */
			waitForDelayedWrite: () => Promise<void>;
			/** Allows delayed filesystem writes to finish. */
			releaseDelayedWrites: () => void;
			/** Rejects delayed filesystem writes after releasing their wait. */
			rejectDelayedWrites: () => void;
			/** Defers one file read after capturing its pre-mutation contents. */
			deferNextRead: (path: string) => void;
			/** Reports whether the deferred read is waiting or finished. */
			getDeferredReadState: () => 'idle' | 'waiting' | 'completed';
			/** Allows the deferred file read to return its captured contents. */
			releaseDeferredRead: () => void;
			/** Defers the next directory check for one path until released. */
			deferNextIsDir: (path: string) => void;
			/** Reports whether the deferred check is waiting or finished. */
			getDeferredIsDirState: () => 'idle' | 'waiting' | 'completed';
			/** Releases the directory check installed by deferNextIsDir. */
			releaseDeferredIsDir: () => void;
			/** Defers one rename or deletion after it reaches the filesystem. */
			deferNextMutation: (
				operation: 'mv' | 'unlink',
				path: string
			) => void;
			/** Reports whether the deferred mutation is waiting or finished. */
			getDeferredMutationState: () => 'idle' | 'waiting' | 'completed';
			/** Allows the deferred rename or deletion to finish. */
			releaseDeferredMutation: () => void;
		};
	}
}

const initialPath = '/wordpress/workspace/index.php';
const notesPath = '/wordpress/workspace/notes.txt';
const renamedNotesPath = '/wordpress/workspace/notes-renamed.txt';
const pluginPath = '/wordpress/wp-content/plugins/akismet.php';
const suffixedInitialPath = '/wordpress/workspace/index (1).php';
const renamedInitialPath = '/wordpress/workspace/main.php';

/** Loads the editor harness and waits until its initial CodeMirror is ready. */
async function gotoHarness(page: Page) {
	await page.goto('/playwright-file-editor.html');
	await page.waitForFunction(() => Boolean(window.__fileEditorHarness));
	await expect(page.locator('.cm-content')).toBeVisible();
}

/** Reads a file from the selected filesystem owned by the editor harness. */
async function readHarnessFile(
	page: Page,
	path: string,
	filesystemIndex?: number
) {
	return page.evaluate(
		({ filePath, index }) => {
			const harness = window.__fileEditorHarness;
			if (!harness) {
				throw new Error('File editor harness is not mounted');
			}
			return harness.readFileAsText(filePath, index);
		},
		{ filePath: path, index: filesystemIndex }
	);
}

/** Reports whether a path is a file in the active harness filesystem. */
async function harnessFileExists(page: Page, path: string) {
	return page.evaluate((filePath) => {
		return window.__fileEditorHarness!.filesystem.fileExists(filePath);
	}, path);
}

/** Writes directly to disk without changing the editor buffer. */
async function writeHarnessFile(page: Page, path: string, content: string) {
	await page.evaluate(
		({ filePath, fileContent }) =>
			window.__fileEditorHarness!.filesystem.writeFile(
				filePath,
				fileContent
			),
		{ filePath: path, fileContent: content }
	);
}

/** Selects one synthetic host file through the editor's hidden upload input. */
async function uploadHarnessFile(page: Page, name: string, content: string) {
	await page.locator('input[name="playground-file-upload"]').setInputFiles({
		name,
		mimeType: 'text/plain',
		buffer: Buffer.from(content),
	});
}

/**
 * Drops a nested host directory on the explorer background or a visible row.
 * Omitting content makes the mock directory entry fail to read its file.
 */
async function dropHarnessDirectoryOnSidebar(
	page: Page,
	content?: string,
	targetPath?: string
) {
	const target = targetPath
		? page.locator(`button[data-path="${targetPath}"]`).first()
		: page.locator('[class*="fileExplorerContainer"]').first();
	await target.evaluate((container, fileContent) => {
		const file = new File([fileContent ?? ''], 'note.txt', {
			type: 'text/plain',
		});
		const fileEntry = {
			isFile: true,
			isDirectory: false,
			name: file.name,
			file: (
				resolve: (value: File) => void,
				reject: (error: DOMException) => void
			) =>
				fileContent === undefined
					? reject(new DOMException('Could not read dropped file'))
					: resolve(file),
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
		const dataTransfer = {
			types: ['Files'],
			items: [
				{
					kind: 'file',
					webkitGetAsEntry: () =>
						dropDataIsReadable ? droppedDirectory : null,
				},
			],
			files: [],
		};
		const dropEvent = new Event('drop', {
			bubbles: true,
			cancelable: true,
		});
		Object.defineProperty(dropEvent, 'dataTransfer', {
			value: dataTransfer,
		});
		container.dispatchEvent(dropEvent);
		dropDataIsReadable = false;
	}, content);
}

/** Drops one synthetic host file on the explorer background. */
async function dropHarnessFileOnSidebar(
	page: Page,
	name: string,
	content: string
) {
	await page
		.locator('[class*="fileExplorerContainer"]')
		.first()
		.evaluate(
			(container, file) => {
				const dropEvent = new Event('drop', {
					bubbles: true,
					cancelable: true,
				});
				Object.defineProperty(dropEvent, 'dataTransfer', {
					value: {
						types: ['Files'],
						items: [],
						files: [new File([file.content], file.name)],
					},
				});
				container.dispatchEvent(dropEvent);
			},
			{ name, content }
		);
}

/** Invokes a tree context action without depending on popover focus timing. */
async function runHarnessContextMenuAction(
	page: Page,
	path: string,
	actionName: 'Rename' | 'Delete'
) {
	const node = page.locator(`button[data-path="${path}"]`).first();
	await expect(node).toBeVisible();
	for (let attempt = 0; attempt < 3; attempt++) {
		await node.dispatchEvent('contextmenu', {
			button: 2,
			clientX: 100,
			clientY: 100,
		});
		try {
			await page
				.getByRole('menuitem', { name: actionName })
				.dispatchEvent('click', undefined, { timeout: 1000 });
			return;
		} catch (error) {
			if (attempt === 2) {
				throw error;
			}
		}
	}
}

/** Opens a tree file, optionally using Enter to move focus into the editor. */
async function openHarnessFile(page: Page, path: string, focusEditor = false) {
	const ancestors: string[] = [];
	let parentPath = dirname(path);
	while (parentPath && parentPath !== '/') {
		ancestors.unshift(parentPath);
		parentPath = dirname(parentPath);
	}
	for (const [index, ancestor] of ancestors.entries()) {
		const folder = page.locator(`button[data-path="${ancestor}"]`).first();
		await expect(folder).toBeVisible();
		const nextPath = ancestors[index + 1] ?? path;
		const nextNode = page
			.locator(`button[data-path="${nextPath}"]`)
			.first();
		if ((await folder.getAttribute('data-expanded')) !== 'true') {
			await folder.click();
		}
		await expect(folder).toHaveAttribute('data-expanded', 'true');
		await expect(nextNode).toBeVisible();
	}
	const file = page.locator(`button[data-path="${path}"]`).first();
	await expect(file).toBeVisible();
	if (focusEditor) {
		await file.focus();
		await file.press('Enter');
	} else {
		await file.click();
	}
	await expect(page.getByText(path, { exact: true })).toBeVisible();
}

/** Selects and expands a directory without replacing the open editor file. */
async function selectHarnessDirectory(page: Page, path: string) {
	const ancestors: string[] = [];
	let current = path;
	while (current && current !== '/') {
		ancestors.unshift(current);
		current = dirname(current);
	}
	for (const [index, directory] of ancestors.entries()) {
		const node = page.locator(`button[data-path="${directory}"]`).first();
		await expect(node).toBeVisible();
		if (index === ancestors.length - 1) {
			await node.click();
			await expect(node).toHaveClass(/selected/);
		} else if ((await node.getAttribute('data-expanded')) !== 'true') {
			await node.click();
			await expect(node).toHaveAttribute('data-expanded', 'true');
		}
	}
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

	await dropHarnessDirectoryOnSidebar(page, content);

	await expect.poll(() => harnessFileExists(page, importedPath)).toBe(true);
	await expect.poll(() => readHarnessFile(page, importedPath)).toBe(content);
	await expect(
		page.locator('button[data-path="/wordpress/workspace/dropped-folder"]')
	).toBeVisible();
});

test('imports uploads and background drops into the selected directory', async ({
	page,
}) => {
	const selectedDirectory = '/wordpress/wp-content/plugins';
	const uploadedPath = `${selectedDirectory}/selected.txt`;
	const droppedPath = `${selectedDirectory}/dropped-folder/nested/note.txt`;

	await selectHarnessDirectory(page, selectedDirectory);
	await uploadHarnessFile(page, 'selected.txt', 'Selected upload');
	await dropHarnessDirectoryOnSidebar(page, 'Selected directory drop');

	await expect
		.poll(() => readHarnessFile(page, uploadedPath))
		.toBe('Selected upload');
	await expect
		.poll(() => readHarnessFile(page, droppedPath))
		.toBe('Selected directory drop');
	await expect(page.getByText(initialPath, { exact: true })).toBeVisible();
	await expect(
		harnessFileExists(page, '/wordpress/workspace/selected.txt')
	).resolves.toBe(false);
});

test('does not redirect an upload when the selected directory cannot be inspected', async ({
	page,
}) => {
	const selectedDirectory = '/wordpress/wp-content/plugins';
	await selectHarnessDirectory(page, selectedDirectory);
	await page.evaluate((path) => {
		const filesystem = window.__fileEditorHarness!.filesystem;
		const originalIsDir = filesystem.isDir.bind(filesystem);
		let failed = false;
		filesystem.isDir = async (candidate) => {
			if (!failed && candidate === path) {
				failed = true;
				throw new Error('Synthetic metadata failure');
			}
			return originalIsDir(candidate);
		};
	}, selectedDirectory);

	await uploadHarnessFile(page, 'misdirected.txt', 'Do not redirect');

	await expect(
		page.locator('.components-notice').filter({
			hasText: 'Could not inspect the selected upload folder.',
		})
	).toBeVisible();
	await expect(
		harnessFileExists(page, `${selectedDirectory}/misdirected.txt`)
	).resolves.toBe(false);
	await expect(
		harnessFileExists(page, '/wordpress/workspace/misdirected.txt')
	).resolves.toBe(false);
});

test('shows a non-blocking error when a dropped directory cannot be read', async ({
	page,
}) => {
	await dropHarnessDirectoryOnSidebar(page);

	await expect(
		page.locator('.components-notice').filter({
			hasText: 'Could not import the dropped files or directories.',
		})
	).toBeVisible();
	await expect(
		harnessFileExists(
			page,
			'/wordpress/workspace/dropped-folder/nested/note.txt'
		)
	).resolves.toBe(false);
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

test('renames a dirty open file without recreating its old path', async ({
	page,
}) => {
	const nextContent = "<?php echo 'Renamed while dirty';";
	const editor = page.locator('.cm-content');
	await editor.click();
	await page.keyboard.press('ControlOrMeta+A');
	await page.keyboard.insertText(nextContent);

	await runHarnessContextMenuAction(page, initialPath, 'Rename');
	const renameInput = page
		.locator(`[data-path="${initialPath}"] input`)
		.first();
	await renameInput.fill('main.php');
	await renameInput.press('Enter');

	await expect(
		page.getByText(renamedInitialPath, { exact: true })
	).toBeVisible();
	await expect
		.poll(() => readHarnessFile(page, renamedInitialPath))
		.toBe(nextContent);
	await expect(harnessFileExists(page, initialPath)).resolves.toBe(false);
	await page.waitForTimeout(1800);
	await expect(harnessFileExists(page, initialPath)).resolves.toBe(false);

	await page.evaluate(() => window.__fileEditorHarness!.remount());
	await expect(page.getByTestId('mount-key')).toHaveText('mountKey: 1');
	await expect(
		page.getByText(renamedInitialPath, { exact: true })
	).toBeVisible();
});

test('shows a non-blocking error when a directory dropped on a row is only partly imported', async ({
	page,
}) => {
	await selectHarnessDirectory(page, '/wordpress/workspace');
	await dropHarnessDirectoryOnSidebar(
		page,
		undefined,
		'/wordpress/workspace'
	);

	await expect(
		page.locator('.components-notice').filter({
			hasText: 'Could not import the dropped files or directories.',
		})
	).toBeVisible();
	await expect(
		page.locator('button[data-path="/wordpress/workspace/dropped-folder"]')
	).toBeVisible();
});

test('deletes a dirty open file without recreating it', async ({ page }) => {
	const editor = page.locator('.cm-content');
	await editor.click();
	await page.keyboard.press('ControlOrMeta+A');
	await page.keyboard.insertText("<?php echo 'Delete while dirty';");

	await runHarnessContextMenuAction(page, initialPath, 'Delete');

	await expect(
		page.getByText('Select a file to view or edit its contents.')
	).toBeVisible();
	await expect(harnessFileExists(page, initialPath)).resolves.toBe(false);
	await page.waitForTimeout(1800);
	await expect(harnessFileExists(page, initialPath)).resolves.toBe(false);

	await page.evaluate(() => window.__fileEditorHarness!.remount());
	await expect(page.getByTestId('mount-key')).toHaveText('mountKey: 1');
	await expect(
		page.getByText('Select a file to view or edit its contents.')
	).toBeVisible();
	await expect(harnessFileExists(page, initialPath)).resolves.toBe(false);
});

test('uploads a colliding filename under a numeric suffix', async ({
	page,
}) => {
	const uploadedContent = "<?php echo 'Uploaded index';";

	await uploadHarnessFile(page, 'index.php', uploadedContent);

	await expect(readHarnessFile(page, initialPath)).resolves.toBe(
		"<?php echo 'Hello';"
	);
	await expect
		.poll(() => readHarnessFile(page, suffixedInitialPath))
		.toBe(uploadedContent);
});

test('serializes a file-input upload with a concurrent tree import', async ({
	page,
}) => {
	const targetPath = '/wordpress/workspace/simultaneous.txt';
	const suffixedPath = '/wordpress/workspace/simultaneous (1).txt';
	await page.evaluate(() => {
		window.__fileEditorHarness!.delayCurrentFilesystemWrites();
	});
	const upload = page
		.locator('input[name="playground-file-upload"]')
		.setInputFiles({
			name: 'simultaneous.txt',
			mimeType: 'text/plain',
			buffer: Buffer.from('input upload'),
		});
	await page.evaluate(() =>
		window.__fileEditorHarness!.waitForDelayedWrite()
	);
	await dropHarnessFileOnSidebar(page, 'simultaneous.txt', 'background drop');
	await page.evaluate(async () => {
		// Cross a task boundary so an unserialized second import reaches its write.
		await new Promise((resolve) => setTimeout(resolve, 0));
		window.__fileEditorHarness!.releaseDelayedWrites();
	});
	await upload;

	await expect
		.poll(() => readHarnessFile(page, targetPath))
		.toBe('input upload');
	await expect
		.poll(() => readHarnessFile(page, suffixedPath))
		.toBe('background drop');
});

test('reports a successful upload whose tree refresh fails', async ({
	page,
}) => {
	const uploadedPath = '/wordpress/workspace/refresh-failure.txt';
	await page.evaluate(() => {
		const filesystem = window.__fileEditorHarness!.filesystem;
		const originalListFiles = filesystem.listFiles.bind(filesystem);
		let shouldFail = true;
		filesystem.listFiles = async (path) => {
			if (shouldFail && path === '/wordpress/workspace') {
				shouldFail = false;
				throw new Error('Synthetic refresh failure');
			}
			return originalListFiles(path);
		};
	});
	await uploadHarnessFile(page, 'refresh-failure.txt', 'uploaded');

	await expect
		.poll(() => readHarnessFile(page, uploadedPath))
		.toBe('uploaded');
	await expect(
		page.locator('.components-notice').filter({
			hasText:
				'Files were uploaded, but the file list could not be refreshed.',
		})
	).toBeVisible();
});

test('does not overwrite an upload target when its metadata lookup fails', async ({
	page,
}) => {
	await page.evaluate((path) => {
		const filesystem = window.__fileEditorHarness!.filesystem;
		const originalFileExists = filesystem.fileExists.bind(filesystem);
		const originalIsDir = filesystem.isDir.bind(filesystem);
		let candidateIsDirCalls = 0;
		filesystem.fileExists = async (candidate) => {
			if (candidate === path) {
				return false;
			}
			return originalFileExists(candidate);
		};
		filesystem.isDir = async (candidate) => {
			if (candidate === path) {
				candidateIsDirCalls += 1;
				if (candidateIsDirCalls > 1) {
					throw new Error('Harness metadata failure');
				}
			}
			return originalIsDir(candidate);
		};
	}, initialPath);
	await uploadHarnessFile(
		page,
		'index.php',
		"<?php echo 'Must not overwrite';"
	);

	await expect(readHarnessFile(page, initialPath)).resolves.toBe(
		"<?php echo 'Hello';"
	);
	await expect(harnessFileExists(page, suffixedInitialPath)).resolves.toBe(
		false
	);
	await expect(harnessFileExists(page, '/wordpress/index.php')).resolves.toBe(
		false
	);
	await expect(
		page
			.locator('.components-notice')
			.filter({ hasText: 'Could not upload 1 file.' })
	).toBeVisible();
});

test('ignores an older selection whose directory check finishes last', async ({
	page,
}) => {
	const newerPath = '/wordpress/workspace/new-file.php';
	await page.evaluate((path) => {
		window.__fileEditorHarness!.deferNextIsDir(path);
	}, notesPath);

	await page.locator(`button[data-path="${notesPath}"]`).first().click();
	await page.waitForFunction(
		() => window.__fileEditorHarness!.getDeferredIsDirState() === 'waiting'
	);
	await page.locator(`button[data-path="${newerPath}"]`).first().click();
	await expect(page.getByText(newerPath, { exact: true })).toBeVisible();

	await page.evaluate(() => {
		window.__fileEditorHarness!.releaseDeferredIsDir();
	});
	await page.waitForFunction(
		() =>
			window.__fileEditorHarness!.getDeferredIsDirState() === 'completed'
	);
	await expect(page.getByText(newerPath, { exact: true })).toBeVisible();
	await expect(page.getByText(notesPath, { exact: true })).toHaveCount(0);
});

test('does not reopen an old path when its delayed read finishes after rename', async ({
	page,
}) => {
	await page.evaluate((path) => {
		window.__fileEditorHarness!.deferNextRead(path);
	}, notesPath);
	await page.locator(`button[data-path="${notesPath}"]`).click();
	await page.waitForFunction(
		() => window.__fileEditorHarness!.getDeferredReadState() === 'waiting'
	);

	await runHarnessContextMenuAction(page, notesPath, 'Rename');
	const renameInput = page
		.locator(`[data-path="${notesPath}"] input`)
		.first();
	await renameInput.fill('notes-renamed.txt');
	await renameInput.press('Enter');
	await expect(
		page.getByText(renamedNotesPath, { exact: true })
	).toBeVisible();

	await page.evaluate(() => {
		window.__fileEditorHarness!.releaseDeferredRead();
	});
	await page.waitForFunction(
		() => window.__fileEditorHarness!.getDeferredReadState() === 'completed'
	);
	await page.waitForTimeout(100);

	await expect(
		page.getByText(renamedNotesPath, { exact: true })
	).toBeVisible();
	await expect(page.getByText(notesPath, { exact: true })).toHaveCount(0);
	await expect(harnessFileExists(page, notesPath)).resolves.toBe(false);
	await expect(harnessFileExists(page, renamedNotesPath)).resolves.toBe(true);
});

test('does not show an obsolete binary message after a newer directory selection', async ({
	page,
}) => {
	const binaryPath = '/wordpress/workspace/obsolete.bin';
	const dirtyContent = "<?php echo 'Keep this editor';";
	await uploadHarnessFile(page, 'obsolete.bin', '\0binary');
	await expect(
		page.locator(`button[data-path="${binaryPath}"]`)
	).toBeVisible();

	await page.evaluate(() =>
		window.__fileEditorHarness!.delayCurrentFilesystemWrites()
	);
	const editor = page.locator('.cm-content');
	await editor.click();
	await page.keyboard.press('ControlOrMeta+A');
	await page.keyboard.insertText(dirtyContent);
	await page.locator(`button[data-path="${binaryPath}"]`).click();
	await page.evaluate(() =>
		window.__fileEditorHarness!.waitForDelayedWrite()
	);

	await selectHarnessDirectory(page, '/wordpress/workspace');
	await page.evaluate(() =>
		window.__fileEditorHarness!.releaseDelayedWrites()
	);

	await expect(page.getByText(initialPath, { exact: true })).toBeVisible();
	await expect(editor).toContainText(dirtyContent);
	await expect(page.getByText('Binary file. Cannot be edited.')).toHaveCount(
		0
	);
});

test('a clean remount preserves an external filesystem change', async ({
	page,
}) => {
	const externalContent = "<?php echo 'Changed outside the editor';";
	await writeHarnessFile(page, initialPath, externalContent);

	await page.evaluate(() => window.__fileEditorHarness!.remount());

	await expect(page.getByTestId('mount-key')).toHaveText('mountKey: 1');
	await expect(page.getByText(initialPath, { exact: true })).toBeVisible();
	await expect(page.locator('.cm-content')).toContainText(externalContent);
	await expect(readHarnessFile(page, initialPath)).resolves.toBe(
		externalContent
	);
});

test('opening a file waits for the previous mount final snapshot', async ({
	page,
}) => {
	const finalContent = "<?php echo 'Read after remount flush';";
	const editor = page.locator('.cm-content');
	await page.evaluate(() =>
		window.__fileEditorHarness!.delayCurrentFilesystemWrites()
	);
	await editor.click();
	await page.keyboard.press('ControlOrMeta+A');
	await page.keyboard.insertText(finalContent);
	await page.evaluate(() => window.__fileEditorHarness!.remount());
	await page.evaluate(() =>
		window.__fileEditorHarness!.waitForDelayedWrite()
	);

	await selectHarnessDirectory(page, '/wordpress/workspace');
	const file = page.locator(`button[data-path="${initialPath}"]`).first();
	await expect(file).toBeVisible();
	await file.click();
	await page.evaluate(() =>
		window.__fileEditorHarness!.releaseDelayedWrites()
	);

	await expect(page.getByText(initialPath, { exact: true })).toBeVisible();
	await expect(editor).toContainText(finalContent);
	await expect
		.poll(() => readHarnessFile(page, initialPath))
		.toBe(finalContent);
});

test('flushes a dirty buffer when remounted before the debounce expires', async ({
	page,
}) => {
	const nextContent = "<?php echo 'Saved during remount';";
	const editor = page.locator('.cm-content');

	await editor.click();
	await page.keyboard.press('ControlOrMeta+A');
	await page.keyboard.insertText(nextContent);
	await page.evaluate(() => window.__fileEditorHarness!.remount());

	await expect(page.getByTestId('mount-key')).toHaveText('mountKey: 1');
	await expect(page.getByText(initialPath, { exact: true })).toBeVisible();
	await expect(editor).toContainText(nextContent);
	await expect
		.poll(() => readHarnessFile(page, initialPath))
		.toBe(nextContent);
});

test('a final remount snapshot wins over an older delayed write', async ({
	page,
}) => {
	const staleContent = "<?php echo 'Stale in-flight save';";
	const finalContent = "<?php echo 'Final remount snapshot';";
	const editor = page.locator('.cm-content');
	await page.evaluate(() =>
		window.__fileEditorHarness!.delayCurrentFilesystemWrites()
	);
	await editor.click();
	await page.keyboard.press('ControlOrMeta+A');
	await page.keyboard.insertText(staleContent);
	await page.evaluate(() =>
		window.__fileEditorHarness!.waitForDelayedWrite()
	);

	await page.keyboard.press('ControlOrMeta+A');
	await page.keyboard.insertText(finalContent);
	await page.evaluate(() => window.__fileEditorHarness!.remount());
	await expect(page.getByTestId('mount-key')).toHaveText('mountKey: 1');
	await page.evaluate(() =>
		window.__fileEditorHarness!.releaseDelayedWrites()
	);

	await expect(page.getByText(initialPath, { exact: true })).toBeVisible();
	await expect(editor).toContainText(finalContent);
	await expect
		.poll(() => readHarnessFile(page, initialPath))
		.toBe(finalContent);
});

test('a rename waits for a pending final snapshot from the previous mount', async ({
	page,
}) => {
	const finalContent = "<?php echo 'Rename after remount';";
	const editor = page.locator('.cm-content');
	await page.evaluate(() =>
		window.__fileEditorHarness!.delayCurrentFilesystemWrites()
	);
	await editor.click();
	await page.keyboard.press('ControlOrMeta+A');
	await page.keyboard.insertText(finalContent);
	await page.evaluate(() => window.__fileEditorHarness!.remount());
	await page.evaluate(() =>
		window.__fileEditorHarness!.waitForDelayedWrite()
	);

	await selectHarnessDirectory(page, '/wordpress/workspace');
	await runHarnessContextMenuAction(page, initialPath, 'Rename');
	const renameInput = page
		.locator(`[data-path="${initialPath}"] input`)
		.first();
	await renameInput.fill('main.php');
	await renameInput.press('Enter');
	await page.evaluate(() =>
		window.__fileEditorHarness!.releaseDelayedWrites()
	);

	await expect(
		page.getByText(renamedInitialPath, { exact: true })
	).toBeVisible();
	await expect
		.poll(() => readHarnessFile(page, renamedInitialPath))
		.toBe(finalContent);
	await expect(harnessFileExists(page, initialPath)).resolves.toBe(false);
});

test('a delete waits for a pending final snapshot from the previous mount', async ({
	page,
}) => {
	const editor = page.locator('.cm-content');
	await page.evaluate(() =>
		window.__fileEditorHarness!.delayCurrentFilesystemWrites()
	);
	await editor.click();
	await page.keyboard.press('ControlOrMeta+A');
	await page.keyboard.insertText("<?php echo 'Delete after remount';");
	await page.evaluate(() => window.__fileEditorHarness!.remount());
	await page.evaluate(() =>
		window.__fileEditorHarness!.waitForDelayedWrite()
	);

	await selectHarnessDirectory(page, '/wordpress/workspace');
	await runHarnessContextMenuAction(page, initialPath, 'Delete');
	await page.evaluate(() =>
		window.__fileEditorHarness!.releaseDelayedWrites()
	);

	await expect(harnessFileExists(page, initialPath)).resolves.toBe(false);
	await page.waitForTimeout(100);
	await expect(harnessFileExists(page, initialPath)).resolves.toBe(false);
});

test('a rename started by the previous mount blocks editing and remaps the new mount', async ({
	page,
}) => {
	await page.evaluate(
		(path) => window.__fileEditorHarness!.deferNextMutation('mv', path),
		initialPath
	);
	await openHarnessFile(page, initialPath);
	await runHarnessContextMenuAction(page, initialPath, 'Rename');
	const renameInput = page
		.locator(`[data-path="${initialPath}"] input`)
		.first();
	await renameInput.fill('main.php');
	await renameInput.press('Enter');
	await page.waitForFunction(
		() =>
			window.__fileEditorHarness!.getDeferredMutationState() === 'waiting'
	);
	await expect(page.locator('.cm-content')).toHaveAttribute(
		'contenteditable',
		'false'
	);

	await page.evaluate(() => window.__fileEditorHarness!.remount());
	await expect(page.getByTestId('mount-key')).toHaveText('mountKey: 1');
	await page.evaluate(() =>
		window.__fileEditorHarness!.releaseDeferredMutation()
	);

	await expect(
		page.getByText(renamedInitialPath, { exact: true })
	).toBeVisible();
	await expect(readHarnessFile(page, renamedInitialPath)).resolves.toBe(
		"<?php echo 'Hello';"
	);
	await expect(harnessFileExists(page, initialPath)).resolves.toBe(false);
});

test('a delete started by the previous mount cannot be recreated by the new mount', async ({
	page,
}) => {
	await page.evaluate(
		(path) => window.__fileEditorHarness!.deferNextMutation('unlink', path),
		initialPath
	);
	await openHarnessFile(page, initialPath);
	await runHarnessContextMenuAction(page, initialPath, 'Delete');
	await page.waitForFunction(
		() =>
			window.__fileEditorHarness!.getDeferredMutationState() === 'waiting'
	);

	await page.evaluate(() => window.__fileEditorHarness!.remount());
	await expect(page.getByTestId('mount-key')).toHaveText('mountKey: 1');
	await page.evaluate(() =>
		window.__fileEditorHarness!.releaseDeferredMutation()
	);

	await expect(harnessFileExists(page, initialPath)).resolves.toBe(false);
	await expect(page.getByText(initialPath, { exact: true })).toHaveCount(0);
	await page.waitForTimeout(100);
	await expect(harnessFileExists(page, initialPath)).resolves.toBe(false);
});

test('flushes a dirty buffer to the old filesystem before switching', async ({
	page,
}) => {
	const nextContent = "<?php echo 'Saved to old filesystem';";
	const editor = page.locator('.cm-content');
	await editor.click();
	await page.keyboard.press('ControlOrMeta+A');
	await page.keyboard.insertText(nextContent);

	await page.evaluate(() => window.__fileEditorHarness!.switchFilesystem());

	await expect(editor).toContainText("<?php echo 'Hello';");
	await expect
		.poll(() => readHarnessFile(page, initialPath, 0))
		.toBe(nextContent);
	await expect(readHarnessFile(page, initialPath, 1)).resolves.toBe(
		"<?php echo 'Hello';"
	);
});

test('exposes the dirty buffer when the old filesystem rejects a switch flush', async ({
	page,
}) => {
	const nextContent = "<?php echo 'Recover this buffer';";
	const editor = page.locator('.cm-content');
	await editor.click();
	await page.keyboard.press('ControlOrMeta+A');
	await page.keyboard.insertText(nextContent);

	await page.evaluate(() => {
		window.__fileEditorHarness!.failCurrentFilesystemWrites();
		window.__fileEditorHarness!.switchFilesystem();
	});

	await expect(page.getByLabel('Recovered unsaved file buffer')).toHaveValue(
		nextContent
	);
	await expect(page.getByText(/were not written/i).first()).toBeVisible();
});

test('shows the recovered dirty buffer while the filesystem is unavailable', async ({
	page,
}) => {
	const nextContent = "<?php echo 'Recover without a filesystem';";
	const editor = page.locator('.cm-content');
	await editor.click();
	await page.keyboard.press('ControlOrMeta+A');
	await page.keyboard.insertText(nextContent);

	await page.evaluate(() => {
		window.__fileEditorHarness!.failCurrentFilesystemWrites();
		window.__fileEditorHarness!.disconnectFilesystem();
	});

	await expect(page.getByLabel('Recovered unsaved file buffer')).toHaveValue(
		nextContent
	);
	await expect(page.getByText(/were not written/i).first()).toBeVisible();
});

test('keeps recovery from a superseded filesystem transition', async ({
	page,
}) => {
	const nextContent = "<?php echo 'Recover after reconnecting';";
	await page.evaluate(() =>
		window.__fileEditorHarness!.delayCurrentFilesystemWrites()
	);
	const editor = page.locator('.cm-content');
	await editor.click();
	await page.keyboard.press('ControlOrMeta+A');
	await page.keyboard.insertText(nextContent);

	await page.evaluate(() =>
		window.__fileEditorHarness!.disconnectFilesystem()
	);
	await page.evaluate(() =>
		window.__fileEditorHarness!.waitForDelayedWrite()
	);
	await page.evaluate(() =>
		window.__fileEditorHarness!.reconnectFilesystem()
	);
	await expect(
		page.locator('input[name="playground-file-upload"]')
	).toBeAttached();
	await page.evaluate(() =>
		window.__fileEditorHarness!.rejectDelayedWrites()
	);

	await expect(page.getByLabel('Recovered unsaved file buffer')).toHaveValue(
		nextContent
	);
});

test('retains a failed final snapshot for the next mount', async ({ page }) => {
	const nextContent = "<?php echo 'Recover failed panel close';";
	const editor = page.locator('.cm-content');
	await editor.click();
	await page.keyboard.press('ControlOrMeta+A');
	await page.keyboard.insertText(nextContent);

	await page.evaluate(() => {
		window.__fileEditorHarness!.failCurrentFilesystemWrites();
		window.__fileEditorHarness!.remount();
	});

	await expect(page.getByTestId('mount-key')).toHaveText('mountKey: 1');
	await expect(page.getByLabel('Recovered unsaved file buffer')).toHaveValue(
		nextContent
	);
});

test('publishes a late failed final snapshot while the new mount has no filesystem', async ({
	page,
}) => {
	const nextContent = "<?php echo 'Late recovery without filesystem';";
	await page.evaluate(() =>
		window.__fileEditorHarness!.delayCurrentFilesystemWrites()
	);
	const editor = page.locator('.cm-content');
	await editor.click();
	await page.keyboard.press('ControlOrMeta+A');
	await page.keyboard.insertText(nextContent);
	await page.evaluate(() => {
		window.__fileEditorHarness!.remount();
		window.__fileEditorHarness!.disconnectFilesystem();
	});
	await expect(page.getByTestId('mount-key')).toHaveText('mountKey: 1');
	await page.evaluate(() =>
		window.__fileEditorHarness!.waitForDelayedWrite()
	);

	await page.evaluate(() =>
		window.__fileEditorHarness!.rejectDelayedWrites()
	);

	await expect(page.getByLabel('Recovered unsaved file buffer')).toHaveValue(
		nextContent
	);
});

test('retains every failed identity-transition buffer', async ({ page }) => {
	const firstContent = "<?php echo 'First recovery';";
	const secondContent = "<?php echo 'Second recovery';";
	const editor = page.locator('.cm-content');
	await editor.click();
	await page.keyboard.press('ControlOrMeta+A');
	await page.keyboard.insertText(firstContent);
	await page.evaluate(() => {
		window.__fileEditorHarness!.failCurrentFilesystemWrites();
		window.__fileEditorHarness!.disconnectFilesystem();
	});
	await expect(page.getByLabel('Recovered unsaved file buffer')).toHaveValue(
		firstContent
	);

	await page.evaluate(() =>
		window.__fileEditorHarness!.reconnectFilesystem()
	);
	await expect(page.getByText(initialPath, { exact: true })).toBeVisible();
	await editor.click();
	await page.keyboard.press('ControlOrMeta+A');
	await page.keyboard.insertText(secondContent);
	await page.evaluate(() => {
		window.__fileEditorHarness!.failCurrentFilesystemWrites();
		window.__fileEditorHarness!.disconnectFilesystem();
	});

	const recoveredBuffers = page.getByLabel('Recovered unsaved file buffer');
	await expect(recoveredBuffers).toHaveCount(2);
	await expect(recoveredBuffers.nth(0)).toHaveValue(firstContent);
	await expect(recoveredBuffers.nth(1)).toHaveValue(secondContent);
});

test('restores the open path and cursor when the same key remounts', async ({
	page,
}) => {
	await openHarnessFile(page, notesPath);
	const editor = page.locator('.cm-content');
	await editor.click();
	await page.keyboard.press('ControlOrMeta+Home');
	await page.keyboard.press('ArrowRight');

	await page.evaluate(() => window.__fileEditorHarness!.remount());
	await expect(page.getByTestId('mount-key')).toHaveText('mountKey: 1');
	await expect(page.getByText(notesPath, { exact: true })).toBeVisible();
	await expect(editor).toBeFocused();
	await page.keyboard.insertText('|');

	await expect(editor).toContainText('W|orkspace notes');
});

test('restores a file cursor when switching away and straight back', async ({
	page,
}) => {
	const otherPath = '/wordpress/workspace/new-file.php';
	await openHarnessFile(page, notesPath);
	const editor = page.locator('.cm-content');
	await editor.click();
	await page.keyboard.press('ControlOrMeta+Home');
	await page.keyboard.press('ArrowRight');

	await openHarnessFile(page, otherPath);
	await openHarnessFile(page, notesPath, true);
	await expect(editor).toBeFocused();
	await page.keyboard.insertText('|');

	await expect(editor).toContainText('W|orkspace notes');
});

test('does not overwrite cursor movement after opening a file', async ({
	page,
}) => {
	const otherPath = '/wordpress/workspace/new-file.php';
	await openHarnessFile(page, notesPath);
	const editor = page.locator('.cm-content');
	await editor.click();
	await page.keyboard.press('ControlOrMeta+End');

	await openHarnessFile(page, otherPath, true);
	await expect(editor).toBeFocused();
	await page.keyboard.press('ControlOrMeta+Home');
	await page.keyboard.press('ArrowRight');
	// The old visibility effect restored again after 100 ms and undid cursor
	// movement made after the file-open handler had already restored it.
	await page.waitForTimeout(150);
	await page.keyboard.insertText('|');

	await expect(editor).toContainText("<|?php echo 'Default';");
});

test('starts an unseen file with identical contents at the beginning', async ({
	page,
}) => {
	const otherPath = '/wordpress/workspace/new-file.php';
	await writeHarnessFile(page, otherPath, 'Workspace notes');
	await openHarnessFile(page, notesPath);
	const editor = page.locator('.cm-content');
	await editor.click();
	await page.keyboard.press('ControlOrMeta+End');

	await openHarnessFile(page, otherPath, true);
	await expect(editor).toBeFocused();
	await page.keyboard.insertText('|');

	await expect(editor).toContainText('|Workspace notes');
});

test('does not undo an edit from a previously open file', async ({ page }) => {
	const otherPath = '/wordpress/workspace/new-file.php';
	const editor = page.locator('.cm-content');
	await openHarnessFile(page, notesPath, true);
	await page.keyboard.press('ControlOrMeta+A');
	await page.keyboard.insertText('Edited notes');

	await openHarnessFile(page, otherPath, true);
	await expect(editor).toBeFocused();
	await page.keyboard.press('ControlOrMeta+Z');

	await expect(editor).toContainText("<?php echo 'Default';");
	await page.waitForTimeout(1600);
	await expect(readHarnessFile(page, otherPath)).resolves.toContain(
		"<?php echo 'Default';"
	);
});

test('resets history when two files have identical current contents', async ({
	page,
}) => {
	const otherPath = '/wordpress/workspace/new-file.php';
	const sharedContent = 'Shared contents';
	await writeHarnessFile(page, otherPath, sharedContent);
	const editor = page.locator('.cm-content');
	await openHarnessFile(page, notesPath, true);
	await page.keyboard.press('ControlOrMeta+A');
	await page.keyboard.insertText(sharedContent);

	await openHarnessFile(page, otherPath, true);
	await expect(editor).toBeFocused();
	await page.keyboard.press('ControlOrMeta+Z');

	await expect(editor).toContainText(sharedContent);
});

test('keeps history when the open file is selected again', async ({ page }) => {
	const editor = page.locator('.cm-content');
	await openHarnessFile(page, notesPath, true);
	await page.keyboard.press('ControlOrMeta+A');
	await page.keyboard.insertText('Edited notes');

	await openHarnessFile(page, notesPath, true);
	await expect(editor).toBeFocused();
	await page.keyboard.press('ControlOrMeta+Z');

	await expect(editor).toContainText('Workspace notes');
});

test('keeps history when the open file is renamed', async ({ page }) => {
	const editor = page.locator('.cm-content');
	await openHarnessFile(page, notesPath, true);
	await page.keyboard.press('ControlOrMeta+A');
	await page.keyboard.insertText('Edited notes');

	await runHarnessContextMenuAction(page, notesPath, 'Rename');
	const renameInput = page
		.locator(`[data-path="${notesPath}"] input`)
		.first();
	await renameInput.fill('notes-renamed.txt');
	await renameInput.press('Enter');
	await expect(
		page.getByText(renamedNotesPath, { exact: true })
	).toBeVisible();
	await editor.click();
	await page.keyboard.press('ControlOrMeta+Z');

	await expect(editor).toContainText('Workspace notes');
});

test('records cursor movement while a file switch waits for its save', async ({
	page,
}) => {
	const otherPath = '/wordpress/workspace/new-file.php';
	await openHarnessFile(page, notesPath);
	const editor = page.locator('.cm-content');
	await editor.click();
	await page.evaluate(() =>
		window.__fileEditorHarness!.delayCurrentFilesystemWrites()
	);
	await page.keyboard.press('ControlOrMeta+A');
	await page.keyboard.insertText('abcdef');

	await page.locator(`button[data-path="${otherPath}"]`).first().click();
	await page.evaluate(() =>
		window.__fileEditorHarness!.waitForDelayedWrite()
	);
	await editor.click();
	await page.keyboard.press('ControlOrMeta+Home');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	await page.evaluate(() =>
		window.__fileEditorHarness!.releaseDelayedWrites()
	);
	await expect(page.getByText(otherPath, { exact: true })).toBeVisible();

	await openHarnessFile(page, notesPath, true);
	await expect(editor).toBeFocused();
	await page.keyboard.insertText('|');

	await expect(editor).toContainText('abcd|ef');
});

test('switching persistence keys does not leak an open path', async ({
	page,
}) => {
	await openHarnessFile(page, notesPath);

	await page.evaluate(() =>
		window.__fileEditorHarness!.setPersistKey('site-b')
	);
	await expect(page.getByText(initialPath, { exact: true })).toBeVisible();

	await page.evaluate(() =>
		window.__fileEditorHarness!.setPersistKey('site-a')
	);
	await expect(page.getByText(notesPath, { exact: true })).toBeVisible();
});

test('a delayed read cannot cross a persistence-key change', async ({
	page,
}) => {
	await openHarnessFile(page, initialPath);
	await page.evaluate((path) => {
		window.__fileEditorHarness!.deferNextRead(path);
	}, notesPath);
	await page.locator(`button[data-path="${notesPath}"]`).first().click();
	await page.waitForFunction(
		() => window.__fileEditorHarness!.getDeferredReadState() === 'waiting'
	);

	await page.evaluate(() =>
		window.__fileEditorHarness!.setPersistKey('site-b')
	);
	await expect(page.getByText(initialPath, { exact: true })).toBeVisible();
	await page.evaluate(() =>
		window.__fileEditorHarness!.releaseDeferredRead()
	);

	await expect(page.getByText(initialPath, { exact: true })).toBeVisible();
	await expect(page.getByText(notesPath, { exact: true })).toHaveCount(0);
	await expect(page.locator('.cm-content')).toContainText(
		"<?php echo 'Hello';"
	);
});

test('switching to an undefined key starts with unkeyed editor state', async ({
	page,
}) => {
	await openHarnessFile(page, notesPath);

	await page.evaluate(() =>
		window.__fileEditorHarness!.setPersistKey(undefined)
	);
	await expect(page.getByText(initialPath, { exact: true })).toBeVisible();
	await openHarnessFile(page, '/wordpress/workspace/new-file.php');

	await page.evaluate(() =>
		window.__fileEditorHarness!.setPersistKey('site-a')
	);
	await expect(page.getByText(notesPath, { exact: true })).toBeVisible();
	await page.evaluate(() =>
		window.__fileEditorHarness!.setPersistKey(undefined)
	);
	await expect(page.getByText(initialPath, { exact: true })).toBeVisible();
});

test('falls back to the initial path when the remembered file was deleted', async ({
	page,
}) => {
	await openHarnessFile(page, notesPath);
	await page.evaluate(() =>
		window.__fileEditorHarness!.setPersistKey('site-b')
	);
	await expect(page.getByText(initialPath, { exact: true })).toBeVisible();
	await page.evaluate((path) => {
		return window.__fileEditorHarness!.deleteFile(path);
	}, notesPath);

	await page.evaluate(() =>
		window.__fileEditorHarness!.setPersistKey('site-a')
	);
	await expect(page.getByText(initialPath, { exact: true })).toBeVisible();
});

test('scopes remembered paths to the active document root', async ({
	page,
}) => {
	await openHarnessFile(page, notesPath);

	await page.evaluate(
		({ root, path }) => {
			window.__fileEditorHarness!.setDocumentRoot(root, path);
		},
		{ root: '/wordpress/wp-content', path: pluginPath }
	);
	await expect(page.getByText(pluginPath, { exact: true })).toBeVisible();

	await page.evaluate(
		({ root, path }) => {
			window.__fileEditorHarness!.setDocumentRoot(root, path);
		},
		{ root: '/wordpress', path: initialPath }
	);
	await expect(page.getByText(notesPath, { exact: true })).toBeVisible();
});
