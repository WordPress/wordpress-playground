// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { getInitialDockState } from './dock-query';

describe('initial Dock pane for query URLs', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it.each([
		['?filebrowser', true, 'files'],
		['?filebrowser=wp-config.php:20', true, 'files'],
		['?filebrowser&overlay=new', true, 'files'],
		['?filebrowser&mode=seamless', false, 'settings'],
		['?overlay=new', true, 'new'],
		['?overlay=blueprints', true, 'new'],
		['?overlay=blueprint', true, 'blueprint'],
		['?overlay=unknown', true, 'playgrounds'],
		['?overlay=save&can-save=no', false, 'settings'],
		['?overlay=logs&mode=seamless', false, 'settings'],
		['', false, 'settings'],
	])('initializes %s', (query, isOpen, section) => {
		expect(
			getInitialDockState(new URL(`/${query}`, window.location.href))
		).toMatchObject({
			dockPaneIsOpen: isOpen,
			dockPaneSection: section,
		});
	});

	it('opens Files on mobile', () => {
		vi.stubGlobal('innerWidth', 390);
		expect(
			getInitialDockState(new URL('/?filebrowser', window.location.href))
		).toMatchObject({
			dockPaneIsOpen: true,
			dockPaneSection: 'files',
		});
	});

	it('ignores filebrowser when embedded', () => {
		vi.stubGlobal('top', {});
		expect(
			getInitialDockState(new URL('/?filebrowser', window.location.href))
		).toMatchObject({
			dockPaneIsOpen: false,
			dockPaneSection: 'settings',
		});
	});
});
