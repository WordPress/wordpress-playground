// @vitest-environment jsdom

import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import AddressBar from './index';

vi.mock('@wordpress/components', () => ({
	Icon: () => <svg aria-hidden="true" />,
	Popover: ({ children }: { children: JSX.Element }) => (
		<div data-testid="popover">{children}</div>
	),
}));

vi.mock('@wordpress/icons', () => ({
	home: {},
	layout: {},
	pin: {},
	wordpress: {},
}));

describe('AddressBar', () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeAll(() => {
		vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
	});

	afterAll(() => {
		vi.unstubAllGlobals();
	});

	beforeEach(() => {
		vi.useFakeTimers();
		container = document.createElement('div');
		document.body.append(container);
		root = createRoot(container);
	});

	afterEach(() => {
		act(() => {
			vi.runOnlyPendingTimers();
			root.unmount();
		});
		vi.useRealTimers();
		container.remove();
	});

	it('keeps focus on the combobox while arrow keys select an option', () => {
		const onUpdate = vi.fn();
		renderAddressBar({ url: '/', onUpdate });
		const input = getInput();

		act(() => input.focus());
		expect(input.getAttribute('role')).toBe('combobox');
		expect(input.getAttribute('aria-expanded')).toBe('true');
		expect(container.querySelector('[role="listbox"]')).not.toBeNull();

		pressKey(input, 'ArrowDown');
		expect(document.activeElement).toBe(input);
		expect(input.getAttribute('aria-activedescendant')).toBe(
			getOption('Homepage').id
		);
		expect(getOption('Homepage').getAttribute('aria-selected')).toBe(
			'true'
		);

		pressKey(input, 'ArrowDown');
		pressKey(input, 'Enter');
		expect(onUpdate).toHaveBeenCalledWith('/wp-admin/');
		expect(container.querySelector('[role="listbox"]')).toBeNull();
	});

	it('wraps ArrowUp from the input to the last option', () => {
		renderAddressBar({ url: '/' });
		const input = getInput();

		act(() => input.focus());
		pressKey(input, 'ArrowUp');

		expect(input.getAttribute('aria-activedescendant')).toBe(
			getOption('Themes').id
		);
		expect(getOption('Themes').getAttribute('aria-selected')).toBe('true');
	});

	it('closes the listbox and disables navigation controls while inert', () => {
		renderAddressBar({ url: '/wp-admin/' });
		act(() => getInput().focus());
		expect(container.querySelector('[role="listbox"]')).not.toBeNull();

		renderAddressBar({ url: '/new-path', disabled: true });
		const input = getInput();
		const refresh = container.querySelector<HTMLButtonElement>(
			'button[aria-label="Refresh page"]'
		)!;

		expect(input.disabled).toBe(true);
		expect(input.value).toBe('/new-path');
		expect(input.getAttribute('aria-expanded')).toBe('false');
		expect(refresh.disabled).toBe(true);
		expect(container.querySelector('[role="listbox"]')).toBeNull();
	});

	function renderAddressBar(props: ComponentProps<typeof AddressBar>) {
		act(() => root.render(<AddressBar {...props} />));
	}

	function getInput() {
		return container.querySelector<HTMLInputElement>(
			'input[role="combobox"]'
		)!;
	}

	function getOption(label: string) {
		return Array.from(
			container.querySelectorAll<HTMLElement>('[role="option"]')
		).find((option) => option.textContent?.includes(label))!;
	}

	function pressKey(input: HTMLInputElement, key: string) {
		act(() => {
			input.dispatchEvent(
				new KeyboardEvent('keydown', { key, bubbles: true })
			);
		});
	}
});
