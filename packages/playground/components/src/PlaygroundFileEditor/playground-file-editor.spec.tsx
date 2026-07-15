// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
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
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import { PlaygroundFileEditor } from './playground-file-editor';
import styles from './playground-file-editor.module.css';

vi.mock('./file-explorer-sidebar', () => ({
	FileExplorerSidebar: ({
		onFileOpened,
	}: {
		onFileOpened: (path: string, content: string) => void;
	}) => (
		<button
			type="button"
			onClick={() => onFileOpened('/wordpress/test.php', 'initial')}
		>
			Open test file
		</button>
	),
}));

vi.mock('./code-editor', async () => {
	const React = await import('react');
	return {
		CodeEditor: React.forwardRef(function MockCodeEditor(
			{
				code,
				onChange,
			}: {
				code: string;
				onChange: (code: string) => void;
			},
			ref
		) {
			React.useImperativeHandle(ref, () => ({
				blur() {},
				focus() {},
				getCursorPosition: () => 0,
				setCursorPosition() {},
			}));
			return (
				<button type="button" onClick={() => onChange(`${code}!`)}>
					Edit test file
				</button>
			);
		}),
	};
});

describe('PlaygroundFileEditor presentation', () => {
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
		vi.useRealTimers();
	});

	it('keeps the existing presentation unless Dock presentation is requested', () => {
		act(() => {
			root.render(
				<PlaygroundFileEditor filesystem={null} documentRoot="/" />
			);
		});

		expect(
			container.firstElementChild?.classList.contains(
				styles['dockPresentation']
			)
		).toBe(false);

		act(() => {
			root.render(
				<PlaygroundFileEditor
					filesystem={null}
					documentRoot="/"
					dockPresentation
				/>
			);
		});

		expect(
			container.firstElementChild?.classList.contains(
				styles['dockPresentation']
			)
		).toBe(true);
	});

	it('keeps one Dock Save button and flushes a pending edit on click', async () => {
		vi.useFakeTimers();
		let finishWrite: () => void = () => {};
		const writePromise = new Promise<void>((resolve) => {
			finishWrite = resolve;
		});
		const filesystem = Object.assign(new EventTarget(), {
			writeFile: vi.fn(() => writePromise),
		}) as unknown as AsyncWritableFilesystem;

		await act(async () => {
			root.render(
				<PlaygroundFileEditor
					filesystem={filesystem}
					documentRoot="/wordpress"
					dockPresentation
				/>
			);
		});

		await clickButton('Open test file');
		const saveButton = findButton('Save');
		expect(saveButton.getAttribute('aria-disabled')).toBe('true');
		expect(findSaveStatus().textContent).toBe('All changes saved.');
		expect(
			saveButton.classList.contains(styles['dockSaveButtonSaved'])
		).toBe(true);

		await clickButton('Edit test file');
		expect(findButton('Save')).toBe(saveButton);
		expect(saveButton.getAttribute('aria-disabled')).toBeNull();
		expect(findSaveStatus().textContent).toBe(
			'Unsaved changes. Click to save now.'
		);
		expect(
			saveButton.classList.contains(styles['dockSaveButtonPending'])
		).toBe(true);

		await clickButton('Save');
		expect(filesystem.writeFile).toHaveBeenCalledWith(
			'/wordpress/test.php',
			'initial!'
		);
		expect(findButton('Save')).toBe(saveButton);
		expect(saveButton.getAttribute('aria-disabled')).toBe('true');
		expect(findSaveStatus().textContent).toBe('Saving changes…');
		expect(container.querySelector('.components-spinner')).toBeNull();

		await act(async () => {
			await vi.advanceTimersByTimeAsync(699);
		});
		expect(container.querySelector('.components-spinner')).toBeNull();

		await act(async () => {
			await vi.advanceTimersByTimeAsync(1);
		});
		expect(container.querySelector('.components-spinner')).not.toBeNull();
		expect(
			saveButton.classList.contains(styles['dockSaveButtonSaving'])
		).toBe(true);

		await act(async () => {
			finishWrite();
			await writePromise;
		});
		expect(findButton('Save')).toBe(saveButton);
		expect(findSaveStatus().textContent).toBe('All changes saved.');
		expect(
			saveButton.classList.contains(styles['dockSaveButtonSaved'])
		).toBe(true);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(2000);
		});
		expect(findButton('Save')).toBe(saveButton);
		expect(saveButton.textContent).toBe('Save');
	});

	it('autosaves after the debounce without changing the Dock button', async () => {
		vi.useFakeTimers();
		const filesystem = Object.assign(new EventTarget(), {
			writeFile: vi.fn(() => Promise.resolve()),
		}) as unknown as AsyncWritableFilesystem;

		await act(async () => {
			root.render(
				<PlaygroundFileEditor
					filesystem={filesystem}
					documentRoot="/wordpress"
					dockPresentation
				/>
			);
		});

		await clickButton('Open test file');
		const saveButton = findButton('Save');
		await clickButton('Edit test file');
		expect(findButton('Save')).toBe(saveButton);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(1499);
		});
		expect(filesystem.writeFile).not.toHaveBeenCalled();

		await act(async () => {
			await vi.advanceTimersByTimeAsync(1);
		});

		expect(filesystem.writeFile).toHaveBeenCalledOnce();
		expect(findButton('Save')).toBe(saveButton);
		expect(saveButton.textContent).toBe('Save');
		expect(
			saveButton.classList.contains(styles['dockSaveButtonSaved'])
		).toBe(true);
		expect(container.querySelector('.components-spinner')).toBeNull();
	});

	async function clickButton(label: string) {
		await act(async () => findButton(label).click());
	}

	function findButton(label: string) {
		const button = Array.from(container.querySelectorAll('button')).find(
			(candidate) => candidate.textContent === label
		);
		if (!button) {
			throw new Error(`Could not find button “${label}”.`);
		}
		return button;
	}

	function findSaveStatus() {
		const status = container.querySelector('[role="status"]');
		if (!status) {
			throw new Error('Could not find save status.');
		}
		return status;
	}
});
