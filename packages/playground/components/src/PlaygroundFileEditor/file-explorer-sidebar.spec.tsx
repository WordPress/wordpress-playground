// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest';
import { FileExplorerSidebar } from './file-explorer-sidebar';
import { MAX_INLINE_FILE_BYTES } from './file-utils';

const filePickerTree = vi.hoisted(() => ({
	props: undefined as
		| { onDoubleClickFile: (path: string) => Promise<void> }
		| undefined,
}));

vi.mock('@wp-playground/components', async () => {
	const React = await import('react');
	return {
		BinaryFilePreview: () => null,
		FilePickerTree: React.forwardRef(function MockFilePickerTree(
			props: { onDoubleClickFile: (path: string) => Promise<void> },
			_ref
		) {
			filePickerTree.props = props;
			return null;
		}),
	};
});

describe('FileExplorerSidebar Dock presentation', () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeAll(() => {
		vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
	});

	afterAll(() => {
		vi.unstubAllGlobals();
	});

	beforeEach(() => {
		container = document.createElement('div');
		document.body.append(container);
		root = createRoot(container);
	});

	afterEach(() => {
		act(() => root.unmount());
		container.remove();
		filePickerTree.props = undefined;
	});

	it('offers a button when a file is too large for inline editing', async () => {
		const arrayBuffer = vi.fn<() => Promise<ArrayBuffer>>();
		const filesystem = Object.assign(new EventTarget(), {
			read: vi.fn().mockResolvedValue({
				size: MAX_INLINE_FILE_BYTES + 1,
				arrayBuffer,
			}),
		}) as unknown as AsyncWritableFilesystem;
		const onShowMessage = vi.fn();

		act(() => {
			root.render(
				<FileExplorerSidebar
					filesystem={filesystem}
					currentPath={null}
					selectedDirPath="/wordpress"
					setSelectedDirPath={() => {}}
					onFileOpened={() => {}}
					onSelectionCleared={() => {}}
					onShowMessage={onShowMessage}
					documentRoot="/wordpress"
					readOnly
					dockPresentation
				/>
			);
		});
		if (!filePickerTree.props) {
			throw new Error('The file picker did not render.');
		}

		await act(async () => {
			await filePickerTree.props!.onDoubleClickFile(
				'/wordpress/large.zip'
			);
		});

		expect(arrayBuffer).not.toHaveBeenCalled();
		expect(onShowMessage).toHaveBeenCalledOnce();
		const message = onShowMessage.mock.calls[0][1];
		act(() => root.render(message));
		const button = Array.from(container.querySelectorAll('button')).find(
			(candidate) => candidate.textContent === 'Download large.zip'
		);
		expect(button?.type).toBe('button');
		expect(container.querySelector('a')).toBeNull();
	});
});
