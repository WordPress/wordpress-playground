// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { DockTabs } from './dock-tabs';

describe('DockTabs', () => {
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

	it('labels the tab region and switches the selected content', async () => {
		await act(async () => {
			root.render(
				<DockTabs
					ariaLabel="Playground tools"
					initialTabName="files"
					tabs={[
						{ name: 'files', title: 'Files' },
						{ name: 'logs', title: 'Logs' },
					]}
				>
					{(tab) => <p>{tab.title} content</p>}
				</DockTabs>
			);
		});

		expect(
			container
				.querySelector('[role="region"]')
				?.getAttribute('aria-label')
		).toBe('Playground tools');
		expect(container.querySelector('[role="tablist"]')).not.toBeNull();
		expect(
			container.querySelector('[role="tab"][aria-selected="true"]')
				?.textContent
		).toBe('Files');
		expect(getSelectedTabPanel().textContent).toContain('Files content');
		expect(getSelectedTabPanel().textContent).not.toContain('Logs content');

		const logsTab = Array.from(
			container.querySelectorAll<HTMLButtonElement>('[role="tab"]')
		).find((tab) => tab.textContent === 'Logs');
		if (!logsTab) {
			throw new Error('The Logs tab did not render.');
		}

		await act(async () => {
			logsTab.click();
		});

		expect(
			container.querySelector('[role="tab"][aria-selected="true"]')
				?.textContent
		).toBe('Logs');
		expect(getSelectedTabPanel().textContent).toContain('Logs content');
	});

	function getSelectedTabPanel(): HTMLElement {
		const selectedTab = container.querySelector(
			'[role="tab"][aria-selected="true"]'
		);
		const panelId = selectedTab?.getAttribute('aria-controls');
		const panel = panelId ? document.getElementById(panelId) : null;

		if (!panel || !container.contains(panel)) {
			throw new Error('The selected tab panel did not render.');
		}

		return panel;
	}
});
