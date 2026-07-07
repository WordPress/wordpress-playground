// @vitest-environment jsdom
import type * as ReactModule from 'react';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import { FilePickerTree } from './index';

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@wordpress/components', async () => {
	const ReactActual = await vi.importActual<typeof ReactModule>('react');
	const passthrough = (tag: string) =>
		function Component({
			children,
			positionInSet,
			setSize,
			...props
		}: any) {
			void positionInSet;
			void setSize;
			return ReactActual.createElement(tag, props, children);
		};
	return {
		Button: passthrough('button'),
		MenuItem: passthrough('button'),
		NavigableMenu: passthrough('div'),
		Popover: ({ children }: any) =>
			ReactActual.createElement('div', null, children),
		__experimentalTreeGrid: passthrough('div'),
		__experimentalTreeGridRow: passthrough('div'),
		__experimentalTreeGridCell: ({ children }: any) =>
			ReactActual.createElement(
				'div',
				null,
				typeof children === 'function' ? children() : children
			),
	};
});

vi.mock('@wordpress/icons', async () => {
	const ReactActual = await vi.importActual<typeof ReactModule>('react');
	return {
		Icon: () => ReactActual.createElement('span', null),
		chevronDown: {},
		chevronRight: {},
	};
});

describe('FilePickerTree file transfer guards', () => {
	let container: HTMLDivElement;
	let root: Root;
	let alertSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		HTMLElement.prototype.scrollIntoView = vi.fn();
		alertSpy = vi
			.spyOn(window, 'alert')
			.mockImplementation(() => undefined);
		container = document.createElement('div');
		document.body.appendChild(container);
		root = createRoot(container);
	});

	afterEach(() => {
		act(() => {
			root.unmount();
		});
		container.remove();
		alertSpy.mockRestore();
	});

	it('does not read or write uploads that exceed the transfer limit', async () => {
		const filesystem = createFilesystem();
		const file = createFile({ name: 'huge.zip', size: 101 * 1024 * 1024 });

		renderTree(root, filesystem);
		await dropFiles(rootButton(container), [file]);

		expect(file.arrayBuffer).not.toHaveBeenCalled();
		expect(filesystem.writeFile).not.toHaveBeenCalled();
		expect(alertSpy).toHaveBeenCalledWith(
			'Could not upload 1 file because the transfer would exceed 100 MB.'
		);
	});

	it('does not read oversized downloads into JavaScript', async () => {
		const file = createFile({ name: 'large.zip', size: 101 * 1024 * 1024 });
		const filesystem = createFilesystem({ '/large.zip': file });

		renderTree(root, filesystem);
		await expandRoot();
		await openContextMenu(await waitForFileButton(container, '/large.zip'));
		await clickMenuItem(container, 'Download');

		expect(file.arrayBuffer).not.toHaveBeenCalled();
		expect(alertSpy).toHaveBeenCalledWith(
			'Cannot download files larger than 100 MB.'
		);
	});
});

function renderTree(root: Root, filesystem: AsyncWritableFilesystem) {
	act(() => {
		root.render(<FilePickerTree filesystem={filesystem} root="/" />);
	});
}

function rootButton(container: HTMLElement): HTMLButtonElement {
	return fileButton(container, '/');
}

function fileButton(container: HTMLElement, path: string): HTMLButtonElement {
	const button = container.querySelector(
		`button[data-path="${path}"]`
	) as HTMLButtonElement | null;
	expect(button).toBeInstanceOf(HTMLButtonElement);
	return button as HTMLButtonElement;
}

async function expandRoot() {
	await act(async () => {
		await settlePromises();
	});
}

async function waitForFileButton(
	container: HTMLElement,
	path: string
): Promise<HTMLButtonElement> {
	for (let attempt = 0; attempt < 20; attempt++) {
		const button = container.querySelector(
			`button[data-path="${path}"]`
		) as HTMLButtonElement | null;
		if (button) {
			return button;
		}
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
	}
	return fileButton(container, path);
}

async function openContextMenu(button: HTMLButtonElement) {
	await act(async () => {
		button.dispatchEvent(
			new MouseEvent('contextmenu', {
				bubbles: true,
				clientX: 1,
				clientY: 1,
			})
		);
	});
}

async function clickMenuItem(container: HTMLElement, label: string) {
	const button = Array.from(container.querySelectorAll('button')).find(
		(element) => element.textContent === label
	);
	expect(button).toBeInstanceOf(HTMLButtonElement);
	await act(async () => {
		button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settlePromises();
	});
}

async function dropFiles(target: HTMLButtonElement, files: File[]) {
	await act(async () => {
		const event = new Event('drop', { bubbles: true, cancelable: true });
		Object.defineProperty(event, 'dataTransfer', {
			value: {
				files,
				items: [],
			},
		});
		target.dispatchEvent(event);
		await settlePromises();
	});
}

async function settlePromises() {
	await Promise.resolve();
	await Promise.resolve();
}

function createFile({ name, size }: { name: string; size: number }): File {
	const file = new File([''], name);
	Object.defineProperty(file, 'size', { value: size });
	file.arrayBuffer = vi.fn(async () => new ArrayBuffer(size));
	return file;
}

function createFilesystem(
	files: Record<
		string,
		{ arrayBuffer(): Promise<ArrayBuffer>; size: number }
	> = {}
): AsyncWritableFilesystem & {
	writeFile: ReturnType<typeof vi.fn>;
} {
	return {
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
		fileExists: vi.fn(async (path: string) => Boolean(files[path])),
		isDir: vi.fn(async (path: string) => path === '/'),
		listFiles: vi.fn(async (path: string) =>
			path === '/'
				? Object.keys(files).map((filePath) => filePath.slice(1))
				: []
		),
		mkdir: vi.fn(async () => undefined),
		mv: vi.fn(async () => undefined),
		read: vi.fn(async (path: string) => files[path]),
		readFileAsText: vi.fn(),
		rmdir: vi.fn(async () => undefined),
		unlink: vi.fn(async () => undefined),
		writeFile: vi.fn(async () => undefined),
	} as unknown as AsyncWritableFilesystem & {
		writeFile: ReturnType<typeof vi.fn>;
	};
}
