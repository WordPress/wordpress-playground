// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@wp-playground/blueprints', () => ({
	BlueprintStepExecutionError: class extends Error {},
}));

describe('initial Dock pane for filebrowser URLs', () => {
	afterEach(() => {
		window.history.replaceState({}, '', '/');
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it.each([
		['?filebrowser', true, 'files'],
		['?filebrowser=wp-config.php:20', true, 'files'],
		['?filebrowser&overlay=new', true, 'files'],
		['?filebrowser&mode=seamless', false, 'settings'],
		['?overlay=new', true, 'new'],
		['', false, 'settings'],
	])('initializes %s', async (query, isOpen, section) => {
		window.history.replaceState({}, '', `/${query}`);
		const { default: reducer } = await import('./slice-ui');
		expect(reducer(undefined, { type: '@@INIT' })).toMatchObject({
			dockPaneIsOpen: isOpen,
			dockPaneSection: section,
		});
	});

	it('opens Files on mobile', async () => {
		vi.stubGlobal('innerWidth', 390);
		window.history.replaceState({}, '', '/?filebrowser');
		const { default: reducer } = await import('./slice-ui');
		expect(reducer(undefined, { type: '@@INIT' })).toMatchObject({
			dockPaneIsOpen: true,
			dockPaneSection: 'files',
		});
	});

	it('ignores filebrowser when embedded', async () => {
		vi.stubGlobal('top', {});
		window.history.replaceState({}, '', '/?filebrowser');
		const { default: reducer } = await import('./slice-ui');
		expect(reducer(undefined, { type: '@@INIT' })).toMatchObject({
			dockPaneIsOpen: false,
			dockPaneSection: 'settings',
		});
	});
});
