// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { useDeveloperTools } from './use-developer-tools';

describe('developer tools visibility', () => {
	let root: Root;
	let container: HTMLDivElement;
	let state: ReturnType<typeof useDeveloperTools>;
	const closePane = vi.fn();

	beforeEach(() => {
		vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
		localStorage.clear();
		closePane.mockClear();
		container = document.createElement('div');
		root = createRoot(container);
	});

	afterEach(() => {
		act(() => root.unmount());
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('remembers explicit choices across remounts', () => {
		render();
		expect(state.isVisible).toBe(false);
		act(() => state.toggle());
		remount();
		expect(state.isVisible).toBe(true);
		act(() => state.toggle());
		remount();
		expect(state.isVisible).toBe(false);
	});

	it('reveals an externally opened pane without persisting the reveal', () => {
		render();
		render(true);
		expect(state.isVisible).toBe(true);
		render(false);
		expect(state.isVisible).toBe(true);
		remount();
		expect(state.isVisible).toBe(false);
	});

	it('closes the developer pane when hidden and respects operation locks', () => {
		render(true, true);
		act(() => state.toggle());
		expect(state.isVisible).toBe(true);
		expect(closePane).not.toHaveBeenCalled();
		render(true, false);
		act(() => state.toggle());
		expect(closePane).toHaveBeenCalledOnce();
		expect(state.isVisible).toBe(false);
	});

	it('keeps working when reading, writing, or clearing storage fails', () => {
		for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
			vi.spyOn(Storage.prototype, method).mockImplementation(() => {
				throw new Error('Storage unavailable');
			});
		}
		render();
		act(() => state.toggle());
		expect(state.isVisible).toBe(true);
		act(() => state.toggle());
		expect(state.isVisible).toBe(false);
	});

	function remount() {
		act(() => root.unmount());
		root = createRoot(container);
		render();
	}

	function render(developerPaneOpen = false, paneCloseBlocked = false) {
		act(() =>
			root.render(
				<Probe
					developerPaneOpen={developerPaneOpen}
					paneCloseBlocked={paneCloseBlocked}
				/>
			)
		);
	}

	function Probe(props: {
		developerPaneOpen: boolean;
		paneCloseBlocked: boolean;
	}) {
		state = useDeveloperTools({
			...props,
			onCloseDeveloperPane: closePane,
		});
		return null;
	}
});
