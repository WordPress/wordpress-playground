import { expect, type Locator, type Page, test } from '@playwright/test';
import type { AsyncWritableFilesystem } from '../../src/FilePickerTree';

type HarnessFilesystem = Pick<
	AsyncWritableFilesystem,
	'readFileAsText' | 'fileExists' | 'isDir'
>;

declare global {
	interface Window {
		__filePickerHarness?: {
			filesystem: HarnessFilesystem;
			reload: () => void;
		};
	}
}

const gotoHarness = async (page: Page) => {
	await page.goto('./?playwrightHarness=file-picker-tree');
	await page.waitForFunction(() => Boolean(window.__filePickerHarness));
	await page.waitForSelector('button[data-path="wordpress"]');
};

const nodeLocator = (page: Page, path: string): Locator =>
	page.locator(`[data-path="${path}"]`);

const nodeButton = (page: Page, path: string): Locator =>
	page.locator(`button[data-path="${path}"]`).first();

const renameInput = (page: Page, path: string): Locator =>
	page.locator(`[data-path="${path}"] input`).first();

const expandNode = async (page: Page, path: string) => {
	await nodeButton(page, path).click();
};

const expectFocused = async (page: Page, path: string) => {
	await expect(nodeButton(page, path)).toHaveClass(/focused__/);
};

const expectSelected = async (page: Page, path: string) => {
	await expect(nodeButton(page, path)).toHaveClass(/selected__/);
};

const callFilesystem = async <
	K extends keyof HarnessFilesystem,
	R = Awaited<ReturnType<HarnessFilesystem[K]>>
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
			return target(...parameters);
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

test.beforeEach(async ({ page }) => {
	await gotoHarness(page);
});

test('renders top level entries for the root filesystem', async ({ page }) => {
	await expect(nodeButton(page, 'wordpress')).toBeVisible();
	await expect(nodeButton(page, 'notes.txt')).toBeVisible();
});

test('expands a folder on click to reveal its children', async ({ page }) => {
	await expandNode(page, 'wordpress');
	await expect(nodeButton(page, 'wordpress/workspace')).toBeVisible();
	await expect(nodeButton(page, 'wordpress/wp-content')).toBeVisible();
});

test('collapses a folder when it is toggled again', async ({ page }) => {
	await expandNode(page, 'wordpress');
	await expect(nodeButton(page, 'wordpress/workspace')).toBeVisible();
	await expandNode(page, 'wordpress');
	await expect(nodeLocator(page, 'wordpress/workspace')).toHaveCount(0);
});

test('arrow right expands the focused directory', async ({ page }) => {
	await expandNode(page, 'wordpress');
	const wpContent = nodeButton(page, 'wordpress/wp-content');
	await wpContent.focus();
	await wpContent.press('ArrowRight');
	await expect(
		nodeButton(page, 'wordpress/wp-content/plugins')
	).toBeVisible();
});

test('arrow left collapses an expanded folder in place', async ({ page }) => {
	await expandNode(page, 'wordpress');
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
	await expandNode(page, 'wordpress');
	await expandNode(page, 'wordpress/wp-content');
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

test('arrow down moves focus to the next visible node', async ({ page }) => {
	await expandNode(page, 'wordpress');
	const root = nodeButton(page, 'wordpress');
	await root.focus();
	await root.press('ArrowDown');
	await expectFocused(page, 'wordpress/workspace');
});

test('arrow up moves focus to the previous visible node', async ({ page }) => {
	await expandNode(page, 'wordpress');
	const workspace = nodeButton(page, 'wordpress/workspace');
	await workspace.focus();
	await workspace.press('ArrowUp');
	await expectFocused(page, 'wordpress');
});

test('type-ahead search focuses the first matching node', async ({ page }) => {
	await expandNode(page, 'wordpress');
	const root = nodeButton(page, 'wordpress');
	await root.focus();
	await root.press('n');
	await expectFocused(page, 'notes.txt');
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

test('renaming a file updates the label and filesystem entry', async ({
	page,
}) => {
	await expandNode(page, 'wordpress');
	await expandNode(page, 'wordpress/workspace');
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

test('renaming a directory keeps it expanded with its children', async ({
	page,
}) => {
	await expandNode(page, 'wordpress');
	await expandNode(page, 'wordpress/wp-content');
	await expandNode(page, 'wordpress/wp-content/themes');
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

test('escape cancels an in-progress rename', async ({ page }) => {
	await expandNode(page, 'wordpress');
	await expandNode(page, 'wordpress/workspace');
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
	await expandNode(page, 'wordpress');
	await expandNode(page, 'wordpress/wp-content');
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
	await expandNode(page, 'wordpress');
	await expandNode(page, 'wordpress/wp-content');
	await nodeButton(page, 'wordpress/wp-content').click({
		button: 'right',
	});
	await page.getByRole('menuitem', { name: 'Create file' }).click();
	const pendingPath = 'wordpress/wp-content/new-file.php';
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
	await expandNode(page, 'wordpress');
	await expandNode(page, 'wordpress/workspace');
	await nodeButton(page, 'wordpress/workspace').click({
		button: 'right',
	});
	await page.getByRole('menuitem', { name: 'Create file' }).click();
	const pendingPath = 'wordpress/workspace/new-file (1).php';
	const input = renameInput(page, pendingPath);
	await expect(input).toHaveValue('new-file (1).php');
	await input.press('Enter');
	await expect(nodeButton(page, pendingPath)).toBeVisible();
	await expect(
		readFileAsText(page, '/wordpress/workspace/new-file (1).php')
	).resolves.toBe('');
});

test('creating a directory through the context menu adds the new folder', async ({
	page,
}) => {
	await expandNode(page, 'wordpress');
	await expandNode(page, 'wordpress/workspace');
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

test('invalid rename on a new file removes the placeholder entry', async ({
	page,
}) => {
	await expandNode(page, 'wordpress');
	await expandNode(page, 'wordpress/workspace');
	await nodeButton(page, 'wordpress/workspace').click({
		button: 'right',
	});
	await page.getByRole('menuitem', { name: 'Create file' }).click();
	const pendingPath = 'wordpress/workspace/new-file (1).php';
	const input = renameInput(page, pendingPath);
	await input.fill('');
	await input.press('Enter');
	await expect(nodeLocator(page, pendingPath)).toHaveCount(0);
	await expect(
		fileExists(page, '/wordpress/workspace/new-file (1).php')
	).resolves.toBe(false);
});
