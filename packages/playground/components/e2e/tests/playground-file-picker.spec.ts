import { expect, type Locator, type Page, test } from '@playwright/test';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';

type HarnessFilesystem = Pick<
	AsyncWritableFilesystem,
	'readFileAsText' | 'fileExists' | 'isDir'
>;

type DeferredFilesystemOperation =
	| 'fileExists'
	| 'writeFile'
	| 'mkdir'
	| 'rmdir'
	| 'mv'
	| 'unlink';

declare global {
	interface Window {
		__pendingFilePickerOperation?: Promise<void>;
		__filePickerHarness?: {
			filesystem: HarnessFilesystem;
			reload: () => void;
			switchFilesystem: () => void;
			setRoot: (root: string) => void;
			createFile: (path?: string) => Promise<void>;
			importExternalItems: (
				dataTransfer: DataTransfer,
				preferredPath?: string
			) => Promise<void>;
			deferNextFilesystemOperation: (
				operation: DeferredFilesystemOperation,
				path: string
			) => void;
			getDeferredFilesystemOperationState: () =>
				| 'idle'
				| 'waiting'
				| 'completed';
			releaseDeferredFilesystemOperation: () => void;
			lastSelectedPath: string | null;
			lastDoubleClickedPath: string | null;
			lastPreparedPathChange: string | null;
			lastPathMove: { from: string; to: string } | null;
			lastPathChangeCompletion: {
				path: string;
				outcome: 'moved' | 'deleted' | 'failed';
			} | null;
		};
	}
}

/**
 * Opens the picker harness and waits until its filesystem-backed rows exist.
 */
const gotoHarness = async (page: Page, query = '') => {
	await page.goto(`/playwright-file-picker.html${query}`);
	await page.waitForFunction(() => Boolean(window.__filePickerHarness));
	await page.waitForSelector('button[data-path]');
};

const canonicalPath = (path: string) =>
	path.startsWith('/') ? path : `/${path}`;

/** Escapes a value for exact matching inside a CSS string selector. */
const cssString = (value: string) =>
	`"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** Builds an exact data-path selector for a tree node. */
const pathSelector = (path: string) =>
	`[data-path=${cssString(canonicalPath(path))}]`;

const nodeLocator = (page: Page, path: string): Locator =>
	page.locator(pathSelector(path));

const nodeButton = (page: Page, path: string): Locator =>
	page.locator(`button${pathSelector(path)}`).first();

const renameInput = (page: Page, path: string): Locator =>
	page.locator(`${pathSelector(path)} input`).first();

const isExpanded = async (page: Page, path: string) =>
	(await nodeButton(page, path).getAttribute('data-expanded')) === 'true';

const ensureExpanded = async (page: Page, path: string) => {
	const button = nodeButton(page, path);
	if (!(await isExpanded(page, path))) {
		await button.click();
	}
	await expect(button).toHaveAttribute('data-expanded', 'true');
};

const ensureCollapsed = async (page: Page, path: string) => {
	const button = nodeButton(page, path);
	if (await isExpanded(page, path)) {
		await button.click();
	}
	await expect(button).toHaveAttribute('data-expanded', 'false');
};

const expandNode = async (page: Page, path: string) => {
	await ensureExpanded(page, path);
};

const collapseNode = async (page: Page, path: string) => {
	await ensureCollapsed(page, path);
};

const expandToPath = async (page: Page, path: string) => {
	const segments = canonicalPath(path).split('/').filter(Boolean);
	let current = '';
	for (const segment of segments) {
		current = `${current}/${segment}`;
		await expandNode(page, current);
	}
};

const expectFocused = async (page: Page, path: string) => {
	await expect(nodeButton(page, path)).toBeFocused();
};

const expectSelected = async (page: Page, path: string) => {
	await expect(nodeButton(page, path)).toHaveClass(/selected/);
};

const callFilesystem = async <
	K extends keyof HarnessFilesystem,
	R = Awaited<ReturnType<HarnessFilesystem[K]>>,
>(
	page: Page,
	method: K,
	...args: Parameters<HarnessFilesystem[K]>
): Promise<R> => {
	return page.evaluate(
		(payload) => {
			const harness = window.__filePickerHarness;
			if (!harness) {
				throw new Error('File picker harness is not mounted');
			}
			const { methodName, parameters } = payload;
			const target = (
				harness.filesystem as Record<
					string,
					(...inner: unknown[]) => unknown
				>
			)[methodName];
			if (typeof target !== 'function') {
				throw new Error(
					`Filesystem method ${methodName} is unavailable`
				);
			}
			return target.apply(harness.filesystem, parameters);
		},
		{
			methodName: method as string,
			parameters: args as unknown[],
		}
	) as Promise<R>;
};

const readFileAsText = (page: Page, path: string) =>
	callFilesystem(page, 'readFileAsText', path);

const fileExists = (page: Page, path: string) =>
	callFilesystem(page, 'fileExists', path);

const isDir = (page: Page, path: string) => callFilesystem(page, 'isDir', path);

const getLastSelectedPath = (page: Page): Promise<string | null> => {
	return page.evaluate(
		() => window.__filePickerHarness?.lastSelectedPath ?? null
	);
};

const getLastDoubleClickedPath = (page: Page): Promise<string | null> => {
	return page.evaluate(
		() => window.__filePickerHarness?.lastDoubleClickedPath ?? null
	);
};

/** Imports a directory whose first child fails and whose second child succeeds. */
const importPartiallyFailingDirectory = async (page: Page) => {
	return page.evaluate(async () => {
		const harness = window.__filePickerHarness;
		if (!harness) {
			throw new Error('File picker harness is not mounted');
		}
		const goodFile = new File(['partial import survived'], 'good.txt', {
			type: 'text/plain',
		});
		const failedEntry = {
			isFile: true,
			isDirectory: false,
			name: 'failed.txt',
			file: (
				_resolve: (file: File) => void,
				reject: (error: DOMException) => void
			) => reject(new DOMException('Synthetic read failure')),
		};
		const goodEntry = {
			isFile: true,
			isDirectory: false,
			name: goodFile.name,
			file: (resolve: (file: File) => void) => resolve(goodFile),
		};
		let wasRead = false;
		const directoryEntry = {
			isFile: false,
			isDirectory: true,
			name: 'partial-folder',
			createReader: () => ({
				readEntries: (resolve: (entries: unknown[]) => void) => {
					resolve(wasRead ? [] : [failedEntry, goodEntry]);
					wasRead = true;
				},
			}),
		};
		let dropDataIsReadable = true;
		const dataTransfer = {
			items: [
				{
					kind: 'file',
					webkitGetAsEntry: () =>
						dropDataIsReadable ? directoryEntry : null,
				},
			],
			files: [],
		};
		const importPromise = harness.importExternalItems(
			dataTransfer as unknown as DataTransfer,
			'/'
		);
		dropDataIsReadable = false;
		try {
			await importPromise;
			return false;
		} catch {
			return true;
		}
	});
};

/** Starts one public host-file import without waiting for it to settle. */
const beginHarnessFileImport = async (
	page: Page,
	name: string,
	content: string,
	preferredPath = '/wordpress/workspace'
) => {
	await page.evaluate(
		({ fileName, fileContent, destination }) => {
			const harness = window.__filePickerHarness!;
			window.__pendingFilePickerOperation = harness.importExternalItems(
				{
					items: [],
					files: [new File([fileContent], fileName)],
				} as unknown as DataTransfer,
				destination
			);
		},
		{ fileName: name, fileContent: content, destination: preferredPath }
	);
};

/** Waits for and clears the public host-file import stored by the harness. */
const finishHarnessFileImport = async (page: Page) => {
	await page.evaluate(async () => {
		await window.__pendingFilePickerOperation;
		delete window.__pendingFilePickerOperation;
	});
};

test.beforeEach(async ({ page }) => {
	page.on('pageerror', (error) => {
		console.error('pageerror', error);
	});
	page.on('console', (message) => {
		console.log(`console:${message.type()}: ${message.text()}`);
	});
	await gotoHarness(page);
});

test('renders top level entries for the root filesystem', async ({ page }) => {
	await expect(nodeButton(page, 'wordpress')).toBeVisible();
	await expect(nodeButton(page, 'notes.txt')).toBeVisible();
});

test('expands a folder on click to reveal its children', async ({ page }) => {
	await collapseNode(page, 'wordpress');
	await expandNode(page, 'wordpress');
	await expect(nodeButton(page, 'wordpress/workspace')).toBeVisible();
	await expect(nodeButton(page, 'wordpress/wp-content')).toBeVisible();
});

test('collapses a folder when it is toggled again', async ({ page }) => {
	await collapseNode(page, 'wordpress');
	await expandNode(page, 'wordpress');
	await expect(nodeButton(page, 'wordpress/workspace')).toBeVisible();
	await collapseNode(page, 'wordpress');
	await expect(nodeLocator(page, 'wordpress/workspace')).toHaveCount(0);
});

test('reloads visible children when the filesystem object changes', async ({
	page,
}) => {
	await expandToPath(page, 'wordpress/workspace');
	await expect(
		nodeButton(page, 'wordpress/workspace/index.php')
	).toBeVisible();
	await nodeButton(page, 'wordpress/workspace/index.php').click();
	await expect
		.poll(() =>
			page.evaluate(() => window.__filePickerHarness?.lastSelectedPath)
		)
		.toBe('/wordpress/workspace/index.php');

	await page.evaluate(() => {
		window.__filePickerHarness?.switchFilesystem();
	});

	await expect(
		nodeButton(page, 'wordpress/workspace/alternate.php')
	).toBeVisible();
	await expect(
		nodeLocator(page, 'wordpress/workspace/index.php')
	).toHaveCount(0);
	await expectSelected(page, 'wordpress/workspace');
	await expect
		.poll(() =>
			page.evaluate(() => window.__filePickerHarness?.lastSelectedPath)
		)
		.toBe('/wordpress/workspace');
});

test('renders an initially selected nested file below a non-root tree', async ({
	page,
}) => {
	await gotoHarness(page, '?nestedInitialPath=1');

	await expect(
		nodeButton(page, '/wordpress/workspace/index.php')
	).toBeVisible();
	await expectSelected(page, '/wordpress/workspace/index.php');
});

test('arrow right expands the focused directory', async ({ page }) => {
	await collapseNode(page, 'wordpress');
	await expandNode(page, 'wordpress');
	await collapseNode(page, 'wordpress/wp-content');
	const wpContent = nodeButton(page, 'wordpress/wp-content');
	await wpContent.focus();
	await wpContent.press('ArrowRight');
	await expect(
		nodeButton(page, 'wordpress/wp-content/plugins')
	).toBeVisible();
});

test('arrow left collapses an expanded folder in place', async ({ page }) => {
	await collapseNode(page, 'wordpress');
	await expandNode(page, 'wordpress');
	await collapseNode(page, 'wordpress/wp-content');
	const wpContent = nodeButton(page, 'wordpress/wp-content');
	await wpContent.focus();
	await wpContent.press('ArrowRight');
	await expect(
		nodeButton(page, 'wordpress/wp-content/plugins')
	).toBeVisible();
	await wpContent.press('ArrowLeft');
	await expect(nodeLocator(page, 'wordpress/wp-content/plugins')).toHaveCount(
		0
	);
});

test('arrow left on a file returns focus to its parent folder', async ({
	page,
}) => {
	await collapseNode(page, 'wordpress');
	await expandNode(page, 'wordpress');
	await expandNode(page, 'wordpress/wp-content');
	await collapseNode(page, 'wordpress/wp-content/plugins');
	const plugins = nodeButton(page, 'wordpress/wp-content/plugins');
	await plugins.focus();
	await plugins.press('ArrowRight');
	const akismet = nodeButton(
		page,
		'wordpress/wp-content/plugins/akismet.php'
	);
	await akismet.focus();
	await akismet.press('ArrowLeft');
	await expectFocused(page, 'wordpress/wp-content/plugins');
});

test('arrow navigation handles paths with selector metacharacters', async ({
	page,
}) => {
	const specialFolder = 'wordpress/workspace/selector "] edge';
	const specialFile = `${specialFolder}/child.php`;

	await expandToPath(page, 'wordpress/workspace');
	const folder = nodeButton(page, specialFolder);
	await folder.focus();
	await folder.press('ArrowRight');
	await expect(nodeButton(page, specialFile)).toBeVisible();

	const file = nodeButton(page, specialFile);
	await file.focus();
	await file.press('ArrowLeft');
	await expectFocused(page, specialFolder);
});

test('preserves backslashes as filename bytes', async ({ page }) => {
	const backslashPath = 'wordpress/workspace/back\\slash.php';

	await expandToPath(page, 'wordpress/workspace');
	const file = nodeButton(page, backslashPath);
	await expect(file).toBeVisible();
	await file.click();
	await expect(getLastSelectedPath(page)).resolves.toBe(
		'/wordpress/workspace/back\\slash.php'
	);
});

test('arrow down moves focus to the next visible node', async ({ page }) => {
	await collapseNode(page, 'wordpress');
	await expandNode(page, 'wordpress');
	const root = nodeButton(page, 'wordpress');
	await root.focus();
	await root.press('ArrowDown');
	await expectFocused(page, 'wordpress/workspace');
});

test('arrow up moves focus to the previous visible node', async ({ page }) => {
	await collapseNode(page, 'wordpress');
	await expandNode(page, 'wordpress');
	const workspace = nodeButton(page, 'wordpress/workspace');
	await workspace.focus();
	await workspace.press('ArrowUp');
	await expectFocused(page, 'wordpress');
});

test('type-ahead search focuses the first matching node', async ({ page }) => {
	await collapseNode(page, 'wordpress');
	await expandNode(page, 'wordpress');
	await expandNode(page, 'wordpress/workspace');
	const root = nodeButton(page, 'wordpress');
	await root.focus();
	await page.keyboard.press('n');
	await page.keyboard.press('o');
	await page.keyboard.press('t');
	await page.keyboard.press('e');
	await page.keyboard.press('s');
	await expectFocused(page, 'wordpress/workspace/notes.txt');
});

test('folder context menu exposes creation actions', async ({ page }) => {
	await nodeButton(page, 'wordpress').click({ button: 'right' });
	await expect(page.getByRole('menu')).toBeVisible();
	await expect(
		page.getByRole('menuitem', { name: 'Create file' })
	).toBeVisible();
	await expect(
		page.getByRole('menuitem', { name: 'Create directory' })
	).toBeVisible();
	await page.keyboard.press('Escape');
});

test('file context menu omits folder-only actions', async ({ page }) => {
	await nodeButton(page, 'notes.txt').click({ button: 'right' });
	await expect(page.getByRole('menu')).toBeVisible();
	await expect(
		page.getByRole('menuitem', { name: 'Create file' })
	).toHaveCount(0);
	await expect(
		page.getByRole('menuitem', { name: 'Create directory' })
	).toHaveCount(0);
	await expect(page.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
	await page.keyboard.press('Escape');
});

test('root context menu omits destructive actions', async ({ page }) => {
	await nodeButton(page, '/').click({ button: 'right' });
	await expect(page.getByRole('menu')).toBeVisible();
	await expect(
		page.getByRole('menuitem', { name: 'Create file' })
	).toBeVisible();
	await expect(
		page.getByRole('menuitem', { name: 'Create directory' })
	).toBeVisible();
	await expect(page.getByRole('menuitem', { name: 'Rename' })).toHaveCount(0);
	await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
	await expect(page.getByRole('menuitem', { name: 'Download' })).toHaveCount(
		0
	);
	await page.keyboard.press('Escape');
});

test('read-only trees retain downloads but hide mutations and disable dragging', async ({
	page,
}) => {
	await gotoHarness(page, '?readOnly=1');
	const file = nodeButton(page, 'notes.txt');

	await expect(file).toHaveAttribute('draggable', 'false');
	await file.click({ button: 'right' });
	await expect(
		page.getByRole('menuitem', { name: 'Download' })
	).toBeVisible();
	await expect(page.getByRole('menuitem', { name: 'Rename' })).toHaveCount(0);
	await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
	await expect(
		page.getByRole('menuitem', { name: 'Create file' })
	).toHaveCount(0);
});

test('context menus remain disabled when the tree is read-only', async ({
	page,
}) => {
	await gotoHarness(page, '?readOnly=1&withoutContextMenu=1');

	await nodeButton(page, 'notes.txt').click({ button: 'right' });
	await expect(page.getByRole('menu')).toHaveCount(0);
});

test('renaming a file updates the label and filesystem entry', async ({
	page,
}) => {
	await expandToPath(page, 'wordpress/workspace');
	await nodeButton(page, 'wordpress/workspace/index.php').click({
		button: 'right',
	});
	await page.getByRole('menuitem', { name: 'Rename' }).click();
	const inputPath = 'wordpress/workspace/index.php';
	const input = renameInput(page, inputPath);
	await expect(input).toBeVisible();
	await input.fill('main.php');
	await input.press('Enter');
	await expect(
		nodeButton(page, 'wordpress/workspace/main.php')
	).toBeVisible();
	await expectSelected(page, 'wordpress/workspace/main.php');
	await expect(
		readFileAsText(page, '/wordpress/workspace/main.php')
	).resolves.toContain('Hello');
});

test('rename is vetoed when destination metadata checks fail', async ({
	page,
}) => {
	const sourcePath = '/wordpress/workspace/index.php';
	const destinationPath = '/wordpress/workspace/notes.txt';
	const sourceContent = "<?php echo 'Hello';";
	const destinationContent = 'Workspace notes';
	await page.evaluate((path) => {
		const filesystem = window.__filePickerHarness!.filesystem;
		const originalFileExists = filesystem.fileExists.bind(filesystem);
		filesystem.fileExists = async (candidate: string) => {
			if (candidate === path) {
				throw new Error('metadata lookup failed');
			}
			return originalFileExists(candidate);
		};
	}, destinationPath);
	await expandToPath(page, 'wordpress/workspace');
	await nodeButton(page, sourcePath).click({
		button: 'right',
	});
	await page.getByRole('menuitem', { name: 'Rename' }).click();
	const input = renameInput(page, sourcePath);
	await input.fill('notes.txt');
	await input.press('Enter');

	await expect(input).toBeVisible();
	await expect(readFileAsText(page, sourcePath)).resolves.toBe(sourceContent);
	await expect(readFileAsText(page, destinationPath)).resolves.toBe(
		destinationContent
	);
});

test('move is vetoed when destination metadata checks fail', async ({
	page,
}) => {
	const sourcePath = '/wordpress/workspace/notes.txt';
	const destinationPath = '/notes.txt';
	await page.evaluate((path) => {
		const filesystem = window.__filePickerHarness!.filesystem;
		const originalFileExists = filesystem.fileExists.bind(filesystem);
		filesystem.fileExists = async (candidate: string) => {
			if (candidate === path) {
				throw new Error('metadata lookup failed');
			}
			return originalFileExists(candidate);
		};
	}, destinationPath);
	await expandToPath(page, 'wordpress/workspace');

	await nodeButton(page, sourcePath).dragTo(nodeButton(page, '/'));

	await expect(readFileAsText(page, sourcePath)).resolves.toBe(
		'Workspace notes'
	);
	await expect(readFileAsText(page, destinationPath)).resolves.toBe(
		'Root notes'
	);
});

test('an in-flight rename settles without changing a replacement tree owner', async ({
	page,
}) => {
	const sourcePath = '/wordpress/workspace/index.php';
	const destinationPath = '/wordpress/workspace/main.php';
	await gotoHarness(page, '?nestedInitialPath=1');
	await page.evaluate((path) => {
		window.__filePickerHarness?.deferNextFilesystemOperation('mv', path);
	}, sourcePath);

	await nodeButton(page, sourcePath).click({ button: 'right' });
	await page.getByRole('menuitem', { name: 'Rename' }).click();
	const input = renameInput(page, sourcePath);
	await input.fill('main.php');
	await input.press('Enter');
	await page.waitForFunction(
		() =>
			window.__filePickerHarness?.getDeferredFilesystemOperationState() ===
			'waiting'
	);

	await page.evaluate(() => {
		window.__filePickerHarness?.setRequestIdentity('owner-b');
	});
	await page.waitForFunction(
		() => window.__filePickerHarness?.requestIdentity === 'owner-b'
	);
	await expect.poll(() => getLastSelectedPath(page)).toBe(sourcePath);
	await page.evaluate(() => {
		window.__filePickerHarness?.releaseDeferredFilesystemOperation();
	});

	await expect.poll(() => fileExists(page, destinationPath)).toBe(true);
	await expect
		.poll(() =>
			page.evaluate(() => window.__filePickerHarness?.lastPathMove)
		)
		.toEqual({ from: sourcePath, to: destinationPath });
	await expect
		.poll(() =>
			page.evaluate(
				() => window.__filePickerHarness?.lastPathChangeCompletion
			)
		)
		.toEqual({ path: sourcePath, outcome: 'moved' });
	await expect(getLastSelectedPath(page)).resolves.toBe(sourcePath);
	await expect(nodeLocator(page, destinationPath)).toHaveCount(0);
});

test('renaming a directory keeps it expanded with its children', async ({
	page,
}) => {
	await expandToPath(page, 'wordpress/wp-content/themes');
	await nodeButton(page, 'wordpress/wp-content/themes').click({
		button: 'right',
	});
	await page.getByRole('menuitem', { name: 'Rename' }).click();
	const input = renameInput(page, 'wordpress/wp-content/themes');
	await input.fill('themes-legacy');
	await input.press('Enter');
	await expect(
		nodeButton(page, 'wordpress/wp-content/themes-legacy')
	).toBeVisible();
	await expect(
		nodeButton(page, 'wordpress/wp-content/themes-legacy/twentytwentyone')
	).toBeVisible();
});

test('renaming a directory remaps a selected child path', async ({ page }) => {
	await expandToPath(page, 'wordpress/workspace');
	await nodeButton(page, 'wordpress/workspace/index.php').click();
	await expect(getLastSelectedPath(page)).resolves.toBe(
		'/wordpress/workspace/index.php'
	);

	await nodeButton(page, 'wordpress/workspace').click({ button: 'right' });
	await page.getByRole('menuitem', { name: 'Rename' }).click();
	const input = renameInput(page, 'wordpress/workspace');
	await input.fill('project');
	await input.press('Enter');

	await expect(nodeButton(page, 'wordpress/project/index.php')).toBeVisible();
	await expect(getLastSelectedPath(page)).resolves.toBe(
		'/wordpress/project/index.php'
	);
});

test('escape cancels an in-progress rename', async ({ page }) => {
	await expandToPath(page, 'wordpress/workspace');
	await nodeButton(page, 'wordpress/workspace/index.php').click({
		button: 'right',
	});
	await page.getByRole('menuitem', { name: 'Rename' }).click();
	const input = renameInput(page, 'wordpress/workspace/index.php');
	await input.fill('temporary.php');
	await input.press('Escape');
	await expect(
		nodeButton(page, 'wordpress/workspace/index.php')
	).toBeVisible();
});

test('deleting a file removes it from the tree view', async ({ page }) => {
	await nodeButton(page, 'notes.txt').click({ button: 'right' });
	await page.getByRole('menuitem', { name: 'Delete' }).click();
	await expect(nodeLocator(page, 'notes.txt')).toHaveCount(0);
	await expect(fileExists(page, '/notes.txt')).resolves.toBe(false);
});

test('deleting a folder moves focus to its parent directory', async ({
	page,
}) => {
	await expandToPath(page, 'wordpress/wp-content/plugins');
	await nodeButton(page, 'wordpress/wp-content/plugins').click({
		button: 'right',
	});
	await page.getByRole('menuitem', { name: 'Delete' }).click();
	await expect(nodeLocator(page, 'wordpress/wp-content/plugins')).toHaveCount(
		0
	);
	await expect(isDir(page, '/wordpress/wp-content/plugins')).resolves.toBe(
		false
	);
	await expectFocused(page, 'wordpress/wp-content');
});

test('creating a file through the context menu inserts a pending rename field', async ({
	page,
}) => {
	await expandToPath(page, 'wordpress/wp-content');
	await nodeButton(page, 'wordpress/wp-content').click({
		button: 'right',
	});
	await page.getByRole('menuitem', { name: 'Create file' }).click();
	const pendingPath = 'wordpress/wp-content/untitled.php';
	const input = renameInput(page, pendingPath);
	await expect(input).toBeVisible();
	await input.fill('plugin.php');
	await input.press('Enter');
	await expect(
		nodeButton(page, 'wordpress/wp-content/plugin.php')
	).toBeVisible();
	await expect(
		readFileAsText(page, '/wordpress/wp-content/plugin.php')
	).resolves.toBe('');
});

test('creating a file reuses an available suffixed name when needed', async ({
	page,
}) => {
	await expandToPath(page, 'wordpress/workspace');
	await nodeButton(page, 'wordpress/workspace').click({
		button: 'right',
	});
	await page.getByRole('menuitem', { name: 'Create file' }).click();
	await renameInput(page, 'wordpress/workspace/untitled.php').press('Enter');

	await nodeButton(page, 'wordpress/workspace').click({
		button: 'right',
	});
	await page.getByRole('menuitem', { name: 'Create file' }).click();
	const pendingPath = 'wordpress/workspace/untitled (1).php';
	const input = renameInput(page, pendingPath);
	await expect(input).toHaveValue('untitled (1).php');
	await input.press('Enter');
	await expect(nodeButton(page, pendingPath)).toBeVisible();
	await expect(
		readFileAsText(page, '/wordpress/workspace/untitled (1).php')
	).resolves.toBe('');
});

test('creating a directory through the context menu adds the new folder', async ({
	page,
}) => {
	await expandToPath(page, 'wordpress/workspace');
	await nodeButton(page, 'wordpress/workspace').click({
		button: 'right',
	});
	await page.getByRole('menuitem', { name: 'Create directory' }).click();
	const pendingPath = 'wordpress/workspace/New Folder (1)';
	const input = renameInput(page, pendingPath);
	await expect(input).toHaveValue('New Folder (1)');
	await input.fill('assets');
	await input.press('Enter');
	await expect(nodeButton(page, 'wordpress/workspace/assets')).toBeVisible();
	await expect(isDir(page, '/wordpress/workspace/assets')).resolves.toBe(
		true
	);
});

test('create targets stay inside the current root', async ({ page }) => {
	const previousRootTarget = '/wordpress/workspace/untitled.php';
	const currentRootTarget = '/wordpress/wp-content/untitled.php';
	await gotoHarness(page, '?nestedInitialPath=1');
	await page.evaluate((targetPath) => {
		const harness = window.__filePickerHarness;
		if (!harness) {
			throw new Error('File picker harness is not mounted');
		}
		harness.deferNextFilesystemOperation('fileExists', targetPath);
		window.__pendingFilePickerOperation = harness.createFile(
			'/wordpress/workspace'
		);
	}, previousRootTarget);
	await page.waitForFunction(
		() =>
			window.__filePickerHarness?.getDeferredFilesystemOperationState() ===
			'waiting'
	);

	await page.evaluate(() => {
		window.__filePickerHarness?.setRoot('/wordpress/wp-content');
	});
	await expect(nodeButton(page, '/wordpress/wp-content')).toBeVisible();
	await page.evaluate(() => {
		window.__filePickerHarness?.releaseDeferredFilesystemOperation();
	});
	await page.evaluate(async () => {
		await window.__pendingFilePickerOperation;
		delete window.__pendingFilePickerOperation;
	});
	await expect(fileExists(page, previousRootTarget)).resolves.toBe(false);

	await page.evaluate(async () => {
		await window.__filePickerHarness?.createFile('/wordpress/workspace');
	});
	await expect(fileExists(page, previousRootTarget)).resolves.toBe(false);

	await page.evaluate(async () => {
		await window.__filePickerHarness?.createFile();
	});
	await expect(fileExists(page, currentRootTarget)).resolves.toBe(true);
	await expect(renameInput(page, currentRootTarget)).toBeVisible();
});

test('partial directory imports refresh the tree and report the failure', async ({
	page,
}) => {
	await expect(importPartiallyFailingDirectory(page)).resolves.toBe(true);
	await expect(nodeButton(page, '/partial-folder')).toBeVisible();
	await expect(
		readFileAsText(page, '/partial-folder/good.txt')
	).resolves.toBe('partial import survived');
	await expect(fileExists(page, '/partial-folder/failed.txt')).resolves.toBe(
		false
	);
});

test('rejects path-like import names while preserving backslashes', async ({
	page,
}) => {
	const results = await page.evaluate(async () => {
		const harness = window.__filePickerHarness!;
		const unsafeFile = new File(['escaped'], '../../escaped.txt');
		const nullFile = new File(['null'], 'null\0byte.txt');
		const safeFile = new File(['backslash'], 'import\\name.txt');
		let fileImportRejected = false;
		try {
			await harness.importExternalItems(
				{
					items: [],
					files: [unsafeFile, nullFile, safeFile],
				} as unknown as DataTransfer,
				'/wordpress/workspace'
			);
		} catch {
			fileImportRejected = true;
		}

		const unsafeDirectory = {
			isFile: false,
			isDirectory: true,
			name: '../../escaped-folder',
			createReader: () => ({
				readEntries: (resolve: (entries: unknown[]) => void) =>
					resolve([]),
			}),
		};
		let directoryImportRejected = false;
		try {
			await harness.importExternalItems(
				{
					items: [
						{
							kind: 'file',
							webkitGetAsEntry: () => unsafeDirectory,
						},
					],
					files: [],
				} as unknown as DataTransfer,
				'/wordpress/workspace'
			);
		} catch {
			directoryImportRejected = true;
		}
		return { fileImportRejected, directoryImportRejected };
	});

	expect(results).toEqual({
		fileImportRejected: true,
		directoryImportRejected: true,
	});
	await expect(fileExists(page, '/escaped.txt')).resolves.toBe(false);
	await expect(fileExists(page, '/escaped-folder')).resolves.toBe(false);
	await expect(
		fileExists(page, '/wordpress/workspace/null\0byte.txt')
	).resolves.toBe(false);
	await expect(
		readFileAsText(page, '/wordpress/workspace/import\\name.txt')
	).resolves.toBe('backslash');
});

test('serializes concurrent public imports before choosing their names', async ({
	page,
}) => {
	await page.evaluate(async () => {
		const harness = window.__filePickerHarness!;
		const targetPath = '/wordpress/workspace/concurrent.txt';
		harness.deferNextFilesystemOperation('writeFile', targetPath);
		/** Builds one captured host-file transfer for the public import API. */
		const createTransfer = (content: string) =>
			({
				items: [],
				files: [new File([content], 'concurrent.txt')],
			}) as unknown as DataTransfer;
		const firstImport = harness.importExternalItems(
			createTransfer('first'),
			'/wordpress/workspace'
		);
		while (harness.getDeferredFilesystemOperationState() !== 'waiting') {
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
		const secondImport = harness.importExternalItems(
			createTransfer('second'),
			'/wordpress/workspace'
		);
		// Cross a task boundary so an unserialized second import completes its write.
		await new Promise((resolve) => setTimeout(resolve, 0));
		harness.releaseDeferredFilesystemOperation();
		await Promise.all([firstImport, secondImport]);
	});

	await expect(
		readFileAsText(page, '/wordpress/workspace/concurrent.txt')
	).resolves.toBe('first');
	await expect(
		readFileAsText(page, '/wordpress/workspace/concurrent (1).txt')
	).resolves.toBe('second');
});

test('serializes an import with a concurrent file creation', async ({
	page,
}) => {
	const targetPath = '/wordpress/workspace/untitled.php';
	const suffixedPath = '/wordpress/workspace/untitled (1).php';
	await page.evaluate((path) => {
		window.__filePickerHarness?.deferNextFilesystemOperation(
			'writeFile',
			path
		);
	}, targetPath);
	await beginHarnessFileImport(page, 'untitled.php', 'imported');
	await page.waitForFunction(
		() =>
			window.__filePickerHarness?.getDeferredFilesystemOperationState() ===
			'waiting'
	);
	await page.evaluate(() => {
		const importOperation = window.__pendingFilePickerOperation!;
		const createOperation = window.__filePickerHarness!.createFile(
			'/wordpress/workspace'
		);
		window.__pendingFilePickerOperation = Promise.all([
			importOperation,
			createOperation,
		]).then(() => undefined);
		window.__filePickerHarness!.releaseDeferredFilesystemOperation();
	});
	await finishHarnessFileImport(page);

	await expect(readFileAsText(page, targetPath)).resolves.toBe('imported');
	await expect(fileExists(page, suffixedPath)).resolves.toBe(true);
});

test('serializes an import with a concurrent rename', async ({ page }) => {
	const sourcePath = '/wordpress/workspace/index.php';
	const targetPath = '/wordpress/workspace/claimed.php';
	await expandToPath(page, '/wordpress/workspace');
	await page.evaluate((path) => {
		window.__filePickerHarness?.deferNextFilesystemOperation(
			'writeFile',
			path
		);
	}, targetPath);
	await beginHarnessFileImport(page, 'claimed.php', 'imported');
	await page.waitForFunction(
		() =>
			window.__filePickerHarness?.getDeferredFilesystemOperationState() ===
			'waiting'
	);

	await nodeButton(page, sourcePath).click({ button: 'right' });
	await page.getByRole('menuitem', { name: 'Rename' }).click();
	const input = renameInput(page, sourcePath);
	await input.fill('claimed.php');
	await input.press('Enter');
	await page.evaluate(() => {
		window.__filePickerHarness!.releaseDeferredFilesystemOperation();
	});
	await finishHarnessFileImport(page);

	await expect(readFileAsText(page, targetPath)).resolves.toBe('imported');
	await expect(fileExists(page, sourcePath)).resolves.toBe(true);
	await expect(input).toBeVisible();
});

test('settles an approved rename invalidated while it is queued', async ({
	page,
}) => {
	const sourcePath = '/wordpress/workspace/index.php';
	const destinationPath = '/wordpress/workspace/main.php';
	const blockerPath = '/wordpress/workspace/blocker.txt';
	await expandToPath(page, '/wordpress/workspace');
	await page.evaluate((path) => {
		window.__filePickerHarness?.deferNextFilesystemOperation(
			'writeFile',
			path
		);
	}, blockerPath);
	await beginHarnessFileImport(page, 'blocker.txt', 'started');
	await page.waitForFunction(
		() =>
			window.__filePickerHarness?.getDeferredFilesystemOperationState() ===
			'waiting'
	);

	await nodeButton(page, sourcePath).click({ button: 'right' });
	await page.getByRole('menuitem', { name: 'Rename' }).click();
	const input = renameInput(page, sourcePath);
	await input.fill('main.php');
	await input.press('Enter');
	await expect
		.poll(() =>
			page.evaluate(
				() => window.__filePickerHarness?.lastPreparedPathChange
			)
		)
		.toBe(sourcePath);
	await page.evaluate(() => {
		window.__filePickerHarness?.setRequestIdentity('owner-b');
	});
	await page.waitForFunction(
		() => window.__filePickerHarness?.requestIdentity === 'owner-b'
	);
	await page.evaluate(() => {
		window.__filePickerHarness?.releaseDeferredFilesystemOperation();
	});
	await finishHarnessFileImport(page);

	await expect(fileExists(page, sourcePath)).resolves.toBe(true);
	await expect(fileExists(page, destinationPath)).resolves.toBe(false);
	await expect
		.poll(() =>
			page.evaluate(
				() => window.__filePickerHarness?.lastPathChangeCompletion
			)
		)
		.toEqual({ path: sourcePath, outcome: 'failed' });
});

test('serializes an import with a concurrent deletion', async ({ page }) => {
	const targetPath = '/wordpress/workspace/notes.txt';
	const suffixedPath = '/wordpress/workspace/notes (1).txt';
	await expandToPath(page, '/wordpress/workspace');
	await page.evaluate((path) => {
		window.__filePickerHarness?.deferNextFilesystemOperation(
			'unlink',
			path
		);
	}, targetPath);

	await nodeButton(page, targetPath).click({ button: 'right' });
	await page.getByRole('menuitem', { name: 'Delete' }).click();
	await page.waitForFunction(
		() =>
			window.__filePickerHarness?.getDeferredFilesystemOperationState() ===
			'waiting'
	);
	await beginHarnessFileImport(page, 'notes.txt', 'reimported');
	await page.evaluate(() => {
		window.__filePickerHarness!.releaseDeferredFilesystemOperation();
	});
	await finishHarnessFileImport(page);

	await expect(readFileAsText(page, targetPath)).resolves.toBe('reimported');
	await expect(fileExists(page, suffixedPath)).resolves.toBe(false);
});

test('cancels a queued import when the logical owner changes', async ({
	page,
}) => {
	const blockerPath = '/wordpress/workspace/blocker.txt';
	const stalePath = '/wordpress/workspace/stale.txt';
	await page.evaluate((path) => {
		window.__filePickerHarness?.deferNextFilesystemOperation(
			'writeFile',
			path
		);
	}, blockerPath);
	await beginHarnessFileImport(page, 'blocker.txt', 'started');
	await page.waitForFunction(
		() =>
			window.__filePickerHarness?.getDeferredFilesystemOperationState() ===
			'waiting'
	);
	await page.evaluate(() => {
		const firstImport = window.__pendingFilePickerOperation!;
		const secondImport = window.__filePickerHarness!.importExternalItems(
			{
				items: [],
				files: [new File(['stale'], 'stale.txt')],
			} as unknown as DataTransfer,
			'/wordpress/workspace'
		);
		window.__pendingFilePickerOperation = Promise.all([
			firstImport,
			secondImport,
		]).then(() => undefined);
		window.__filePickerHarness!.setRequestIdentity('owner-b');
	});
	await page.waitForFunction(
		() => window.__filePickerHarness?.requestIdentity === 'owner-b'
	);
	await page.evaluate(() => {
		window.__filePickerHarness!.releaseDeferredFilesystemOperation();
	});
	await finishHarnessFileImport(page);

	await expect(fileExists(page, blockerPath)).resolves.toBe(true);
	await expect(fileExists(page, stalePath)).resolves.toBe(false);
});

test('invalid rename on a new file removes the placeholder entry', async ({
	page,
}) => {
	await expandToPath(page, 'wordpress/workspace');
	await nodeButton(page, 'wordpress/workspace').click({
		button: 'right',
	});
	await page.getByRole('menuitem', { name: 'Create file' }).click();
	const pendingPath = 'wordpress/workspace/untitled.php';
	const input = renameInput(page, pendingPath);
	await input.fill('');
	await expect(input).toHaveValue('');
	await input.press('Enter');
	await expect(nodeLocator(page, pendingPath)).toHaveCount(0);
	await expect(
		fileExists(page, '/wordpress/workspace/untitled.php')
	).resolves.toBe(false);
});

test('newly created files appear at top of files list', async ({ page }) => {
	await expandToPath(page, 'wordpress/workspace');
	await nodeButton(page, 'wordpress/workspace').click({
		button: 'right',
	});
	await page.getByRole('menuitem', { name: 'Create file' }).click();

	// Wait for the rename input to appear - new files are named 'untitled.php' by default
	const pendingPath = 'wordpress/workspace/untitled.php';
	const input = renameInput(page, pendingPath);
	await expect(input).toBeVisible();

	// Verify it's shown in edit mode (rename input visible and focused)
	await expect(input).toBeFocused();

	// The file element should be present (as a form while renaming, not a button)
	const fileNode = nodeLocator(page, pendingPath);
	await expect(fileNode).toBeVisible();

	// Complete the rename to verify the file persists
	await input.press('Enter');

	// Now it should be a button after renaming is complete
	const untitledButton = nodeButton(page, pendingPath);
	await expect(untitledButton).toBeVisible();
});

test('context menu auto-focuses first item', async ({ page }) => {
	await nodeButton(page, 'wordpress').click({ button: 'right' });
	await expect(page.getByRole('menu')).toBeVisible();

	// The first menu item should be focused
	const firstMenuItem = page.getByRole('menuitem', { name: 'Create file' });
	await expect(firstMenuItem).toBeFocused();
});

test('single click on file triggers onSelect but not onDoubleClickFile', async ({
	page,
}) => {
	await expandToPath(page, 'wordpress/workspace');
	const file = nodeButton(page, 'wordpress/workspace/index.php');

	// Single click the file
	await file.click();

	// Wait a bit to ensure single-click timeout completes
	await page.waitForTimeout(350);

	// onSelect should have been called
	const selected = await getLastSelectedPath(page);
	expect(selected).toBe('/wordpress/workspace/index.php');

	// onDoubleClickFile should NOT have been called
	const doubleClicked = await getLastDoubleClickedPath(page);
	expect(doubleClicked).toBeNull();
});

test('double click on file triggers onDoubleClickFile', async ({ page }) => {
	await expandToPath(page, 'wordpress/workspace');
	const file = nodeButton(page, 'wordpress/workspace/index.php');

	// Double click the file
	await file.dblclick();

	// Wait for double-click handler
	await page.waitForTimeout(100);

	// onDoubleClickFile should have been called
	const doubleClicked = await getLastDoubleClickedPath(page);
	expect(doubleClicked).toBe('/wordpress/workspace/index.php');
});

test('pressing Enter on file triggers onDoubleClickFile', async ({ page }) => {
	await expandToPath(page, 'wordpress/workspace');
	const file = nodeButton(page, 'wordpress/workspace/index.php');

	// Focus and press Enter
	await file.focus();
	await file.press('Enter');

	// Wait for Enter handler
	await page.waitForTimeout(100);

	// onDoubleClickFile should have been called
	const doubleClicked = await getLastDoubleClickedPath(page);
	expect(doubleClicked).toBe('/wordpress/workspace/index.php');
});

test('pressing Enter on folder toggles expansion without triggering doubleClick', async ({
	page,
}) => {
	await collapseNode(page, 'wordpress');
	await expandNode(page, 'wordpress');
	await collapseNode(page, 'wordpress/workspace');

	const folder = nodeButton(page, 'wordpress/workspace');
	await folder.focus();

	// Press Enter to expand
	await folder.press('Enter');
	await expect(folder).toHaveAttribute('data-expanded', 'true');

	// onDoubleClickFile should NOT have been called (it's a folder)
	const doubleClicked = await getLastDoubleClickedPath(page);
	expect(doubleClicked).toBeNull();
});

test('rename input is not affected by type-ahead search', async ({ page }) => {
	// First, create a folder with name "123" that could trigger type-ahead
	await expandToPath(page, 'wordpress/workspace');
	await nodeButton(page, 'wordpress/workspace').click({ button: 'right' });
	await page.getByRole('menuitem', { name: 'Create directory' }).click();

	// Find the rename input dynamically (don't hardcode the path as it may be "New Folder (1)" etc)
	// Wait for any visible focused input field in the tree
	const folderInput = page.locator('input[class*="renameInput"]').first();
	await expect(folderInput).toBeVisible();
	await expect(folderInput).toBeFocused();

	// Rename the new folder to "123"
	await folderInput.fill('123');
	await folderInput.press('Enter');

	// Wait for the folder to appear with the new name
	await expect(nodeButton(page, 'wordpress/workspace/123')).toBeVisible();

	// Now try to rename a file and type "1" which matches the folder name
	await nodeButton(page, 'wordpress/workspace/index.php').click({
		button: 'right',
	});
	await page.getByRole('menuitem', { name: 'Rename' }).click();

	const fileInput = renameInput(page, 'wordpress/workspace/index.php');
	await expect(fileInput).toBeVisible();
	await expect(fileInput).toBeFocused();

	// Clear the input and type "1" which would normally trigger type-ahead to folder "123"
	await fileInput.fill('');
	await page.keyboard.press('1');

	// The rename input should still be visible and focused (not closed)
	await expect(fileInput).toBeVisible();
	await expect(fileInput).toBeFocused();

	// The input should contain "1"
	await expect(fileInput).toHaveValue('1');

	// The folder "123" should NOT be focused (type-ahead should be disabled during rename)
	await expect(nodeButton(page, 'wordpress/workspace/123')).not.toBeFocused();

	// Complete the rename with a valid filename
	await fileInput.fill('1test.php');
	await fileInput.press('Enter');

	// Verify the file was renamed successfully
	await expect(
		nodeButton(page, 'wordpress/workspace/1test.php')
	).toBeVisible();
	await expect(
		nodeLocator(page, 'wordpress/workspace/index.php')
	).toHaveCount(0);
});
