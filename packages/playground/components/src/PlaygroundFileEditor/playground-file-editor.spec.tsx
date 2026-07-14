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

	it('enables Dock save for a pending edit and disables it while saving', async () => {
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
		expect(findButton('File saved').disabled).toBe(true);

		await clickButton('Edit test file');
		expect(findButton('Save file').disabled).toBe(false);

		await clickButton('Save file');
		expect(filesystem.writeFile).toHaveBeenCalledWith(
			'/wordpress/test.php',
			'initial!'
		);
		expect(findButton('Saving…').disabled).toBe(true);

		await act(async () => {
			finishWrite();
			await writePromise;
		});
		expect(findButton('File saved').disabled).toBe(true);
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
});
