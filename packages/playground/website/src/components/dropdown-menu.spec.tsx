// @vitest-environment jsdom

import { MenuGroup } from '@wordpress/components';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DropdownMenu } from './dropdown-menu';

describe('DropdownMenu', () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeAll(() => {
		vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
		vi.stubGlobal(
			'matchMedia',
			vi.fn((query: string) => ({
				matches: false,
				media: query,
				onchange: null,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				addListener: vi.fn(),
				removeListener: vi.fn(),
				dispatchEvent: vi.fn(),
			}))
		);
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

	it('adds Home and End navigation without replacing the menu key handler', async () => {
		const onKeyDown = vi.fn();
		await act(async () => {
			root.render(
				<DropdownMenu
					icon={null}
					label="Actions"
					menuProps={{ onKeyDown }}
					popoverProps={{ focusOnMount: false }}
				>
					{() => (
						<MenuGroup>
							<button type="button" role="menuitem">
								First
							</button>
							<button type="button" role="menuitem">
								Middle
							</button>
							<button type="button" role="menuitem">
								Last
							</button>
						</MenuGroup>
					)}
				</DropdownMenu>
			);
		});

		await act(async () => getButton('Actions').click());

		const menu = document.querySelector<HTMLElement>(
			'[role="menu"][aria-label="Actions"]'
		);
		const menuItems =
			menu?.querySelectorAll<HTMLElement>('[role="menuitem"]');
		if (!menuItems || menuItems.length !== 3) {
			throw new Error(
				'Expected the Actions menu to contain three items.'
			);
		}

		act(() => {
			menuItems[1].focus();
			menuItems[1].dispatchEvent(
				new KeyboardEvent('keydown', {
					key: 'Home',
					code: 'Home',
					bubbles: true,
				})
			);
		});
		expect(document.activeElement).toBe(menuItems[0]);

		act(() => {
			menuItems[0].dispatchEvent(
				new KeyboardEvent('keydown', {
					key: 'End',
					code: 'End',
					bubbles: true,
				})
			);
		});
		expect(document.activeElement).toBe(menuItems[2]);
		expect(onKeyDown).toHaveBeenCalledTimes(2);
	});

	function getButton(name: string): HTMLButtonElement {
		const button = container.querySelector<HTMLButtonElement>(
			`button[aria-label="${name}"]`
		);
		if (!button) {
			throw new Error(`Button not found: ${name}`);
		}
		return button;
	}
});
