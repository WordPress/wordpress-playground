// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { useDockPaneState } from './use-dock-pane-state';
import type { DockPaneState } from './use-dock-pane-state';

describe('useDockPaneState', () => {
	let container: HTMLDivElement;
	let root: Root;
	let state: DockPaneState | undefined;

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

	it('keeps the selected width while the pane closes and reopens', () => {
		act(() => {
			root.render(<DockPaneStateProbe />);
		});

		expect(getState().isOpen).toBe(false);
		expect(getState().width).toBe(480);
		const { open, close, setWidth } = getState();

		act(() => getState().open());
		act(() => getState().setWidth(640));
		act(() => getState().close());
		act(() => getState().open());

		expect(getState()).toMatchObject({ isOpen: true, width: 640 });
		expect(getState().open).toBe(open);
		expect(getState().close).toBe(close);
		expect(getState().setWidth).toBe(setWidth);
	});

	function DockPaneStateProbe() {
		state = useDockPaneState(480);
		return null;
	}

	function getState(): DockPaneState {
		if (!state) {
			throw new Error('The pane state probe has not rendered.');
		}

		return state;
	}
});
