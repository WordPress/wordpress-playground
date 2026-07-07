// @vitest-environment jsdom
import type * as ReactModule from 'react';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import { FileExplorerSidebar } from './file-explorer-sidebar';

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
	latestTreeProps: undefined as any,
	createFile: vi.fn(),
	createFolder: vi.fn(),
}));

vi.mock('@wordpress/components', async () => {
	const ReactActual = await vi.importActual<typeof ReactModule>('react');
	return {
		Icon: () => ReactActual.createElement('span', null),
	};
});

vi.mock('@wp-playground/components', async () => {
	const ReactActual = await vi.importActual<typeof ReactModule>('react');
	return {
		BinaryFilePreview: () => ReactActual.createElement('div', null),
		FilePickerTree: ReactActual.forwardRef((props: any, ref) => {
			mocks.latestTreeProps = props;
			ReactActual.useImperativeHandle(ref, () => ({
				createFile: mocks.createFile,
				createFolder: mocks.createFolder,
			}));
			return ReactActual.createElement('div', {
				'aria-label': 'File tree',
			});
		}),
	};
});

describe('FileExplorerSidebar file tree action target', () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		mocks.latestTreeProps = undefined;
		mocks.createFile.mockReset();
		mocks.createFolder.mockReset();
		container = document.createElement('div');
		document.body.appendChild(container);
		root = createRoot(container);
	});

	afterEach(() => {
		act(() => {
			root.unmount();
		});
		container.remove();
	});

	it('remaps the remembered folder for New File after a folder rename', async () => {
		const onPathMoved = vi.fn();
		renderSidebar(root, { onPathMoved });

		await selectFolder('/wordpress/wp-content/plugins');
		await act(async () => {
			await mocks.latestTreeProps.onPathMoved(
				'/wordpress/wp-content/plugins',
				'/wordpress/wp-content/extensions'
			);
		});
		await clickButton(container, 'New File');

		expect(onPathMoved).toHaveBeenCalledWith(
			'/wordpress/wp-content/plugins',
			'/wordpress/wp-content/extensions'
		);
		expect(mocks.createFile).toHaveBeenCalledWith(
			'/wordpress/wp-content/extensions'
		);
	});

	it('clears the remembered folder for New Folder after deleting it', async () => {
		renderSidebar(root);

		await selectFolder('/wordpress/wp-content/plugins');
		await act(async () => {
			await mocks.latestTreeProps.onPathDeleted(
				'/wordpress/wp-content/plugins'
			);
		});
		await clickButton(container, 'New Folder');

		expect(mocks.createFolder).toHaveBeenCalledWith(undefined);
	});
});

function renderSidebar(
	root: Root,
	overrides: Partial<React.ComponentProps<typeof FileExplorerSidebar>> = {}
) {
	act(() => {
		root.render(
			<FileExplorerSidebar
				filesystem={createFilesystem()}
				currentPath={null}
				selectedDirPath={null}
				setSelectedDirPath={vi.fn()}
				onFileOpened={vi.fn()}
				onSelectionCleared={vi.fn()}
				onShowMessage={vi.fn()}
				documentRoot="/wordpress"
				{...overrides}
			/>
		);
	});
}

async function selectFolder(path: string) {
	await act(async () => {
		await mocks.latestTreeProps.onSelect(path);
	});
}

async function clickButton(container: HTMLElement, label: string) {
	const button = Array.from(container.querySelectorAll('button')).find(
		(element) => element.textContent === label
	);
	expect(button).toBeInstanceOf(HTMLButtonElement);
	await act(async () => {
		button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	});
}

function createFilesystem(): AsyncWritableFilesystem {
	return {
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
		fileExists: vi.fn(async () => false),
		isDir: vi.fn(async () => true),
		listFiles: vi.fn(async () => []),
		mkdir: vi.fn(async () => undefined),
		mv: vi.fn(async () => undefined),
		read: vi.fn(),
		readFileAsText: vi.fn(),
		rmdir: vi.fn(async () => undefined),
		unlink: vi.fn(async () => undefined),
		writeFile: vi.fn(async () => undefined),
	} as unknown as AsyncWritableFilesystem;
}
