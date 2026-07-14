// @vitest-environment jsdom

import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { TruncatedText } from './truncated-text';

vi.mock('@wordpress/components', () => ({
	Tooltip: ({ children, text }: { children: ReactNode; text?: string }) => (
		<span data-tooltip={text}>{children}</span>
	),
}));

describe('TruncatedText', () => {
	let container: HTMLDivElement;
	let root: Root;
	let clientWidth: number;
	let scrollWidth: number;
	let resize: () => void;
	let observedElement: Element;
	let originalClientWidth: PropertyDescriptor | undefined;
	let originalScrollWidth: PropertyDescriptor | undefined;

	beforeAll(() => {
		vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
		vi.stubGlobal(
			'ResizeObserver',
			class {
				constructor(callback: () => void) {
					resize = callback;
				}
				observe(element: Element) {
					observedElement = element;
				}
				disconnect() {}
			}
		);
		originalClientWidth = Object.getOwnPropertyDescriptor(
			HTMLElement.prototype,
			'clientWidth'
		);
		originalScrollWidth = Object.getOwnPropertyDescriptor(
			HTMLElement.prototype,
			'scrollWidth'
		);
		Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
			configurable: true,
			get: () => clientWidth,
		});
		Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
			configurable: true,
			get: () => scrollWidth,
		});
	});

	afterAll(() => {
		vi.unstubAllGlobals();
		restoreProperty('clientWidth', originalClientWidth);
		restoreProperty('scrollWidth', originalScrollWidth);
	});

	beforeEach(() => {
		clientWidth = 100;
		scrollWidth = 80;
		container = document.createElement('div');
		document.body.append(container);
		root = createRoot(container);
	});

	afterEach(() => {
		act(() => root.unmount());
		container.remove();
	});

	it('adds an immediate tooltip only while the text is clipped', () => {
		act(() => {
			root.render(
				<TruncatedText className="measured-text">
					Playground title
				</TruncatedText>
			);
		});
		const text = container.querySelector('.measured-text')!;
		expect(observedElement).toBe(text);
		expect(container.querySelector('[data-tooltip]')).toBeNull();
		expect(text.getAttribute('tabindex')).toBe('-1');

		scrollWidth = 180;
		act(() => resize());
		expect(
			container
				.querySelector('[data-tooltip]')
				?.getAttribute('data-tooltip')
		).toBe('Playground title');
		expect(text.getAttribute('tabindex')).toBe('0');

		scrollWidth = 80;
		act(() => resize());
		expect(container.querySelector('[data-tooltip]')).toBeNull();
		expect(text.getAttribute('tabindex')).toBe('-1');
	});
});

function restoreProperty(
	name: 'clientWidth' | 'scrollWidth',
	descriptor: PropertyDescriptor | undefined
) {
	if (descriptor) {
		Object.defineProperty(HTMLElement.prototype, name, descriptor);
	} else {
		Reflect.deleteProperty(HTMLElement.prototype, name);
	}
}
