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
import { PlaygroundFileEditor } from './playground-file-editor';
import styles from './playground-file-editor.module.css';

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
});
