// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import ModalButtons from './modal-buttons';

describe('ModalButtons', () => {
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
				addListener: vi.fn(),
				removeListener: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
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

	it('keeps the existing behavior when no Cancel override is supplied', () => {
		const [cancel, submit] = renderButtons(
			<ModalButtons areDisabled onCancel={() => {}} />
		);

		expect(cancel.disabled).toBe(true);
		expect(submit.disabled).toBe(true);
	});

	it('can keep Cancel enabled when only the submit action is invalid', () => {
		const [cancel, submit] = renderButtons(
			<ModalButtons
				areDisabled
				cancelDisabled={false}
				onCancel={() => {}}
			/>
		);

		expect(cancel.disabled).toBe(false);
		expect(submit.disabled).toBe(true);
	});

	it('can disable Cancel independently for an in-flight operation', () => {
		const [cancel, submit] = renderButtons(
			<ModalButtons cancelDisabled onCancel={() => {}} />
		);

		expect(cancel.disabled).toBe(true);
		expect(submit.disabled).toBe(false);
	});

	function renderButtons(element: JSX.Element) {
		act(() => root.render(element));
		const buttons = container.querySelectorAll('button');
		if (buttons.length !== 2) {
			throw new Error(
				`Expected two modal buttons, received ${buttons.length}.`
			);
		}
		return [buttons[0], buttons[1]] as const;
	}
});
