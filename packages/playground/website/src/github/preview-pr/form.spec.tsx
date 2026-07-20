// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import PreviewPRForm from './form';

vi.mock('@wordpress/components', () => ({
	Button: ({
		children,
		isBusy: _isBusy,
		variant: _variant,
		...props
	}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
		isBusy?: boolean;
		variant?: string;
	}) => <button {...props}>{children}</button>,
	Notice: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	Spinner: () => <span>Loading</span>,
	TextControl: ({
		label,
		onChange,
		...props
	}: React.InputHTMLAttributes<HTMLInputElement> & {
		label: string;
		onChange: (value: string) => void;
	}) => (
		<label>
			{label}
			<input
				{...props}
				onChange={(event) => onChange(event.target.value)}
			/>
		</label>
	),
}));

vi.mock('../../components/modal/modal-buttons', () => ({
	default: () => null,
}));

describe('PreviewPRForm', () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
		container = document.createElement('div');
		document.body.append(container);
		root = createRoot(container);
	});

	afterEach(() => {
		act(() => root.unmount());
		container.remove();
		vi.unstubAllGlobals();
	});

	it('checks both repositories before resolving a bare PR number', async () => {
		const fetchMock = vi.fn((input: RequestInfo | URL) => {
			const url = String(input);
			const error = url.includes('repo=gutenberg')
				? 'artifact_expired'
				: 'Request failed';
			return Promise.resolve(
				new Response(JSON.stringify({ error }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				})
			);
		});
		vi.stubGlobal('fetch', fetchMock);

		act(() => {
			root.render(<PreviewPRForm inline onClose={() => {}} />);
		});
		const input = container.querySelector('input')!;
		act(() => {
			Object.getOwnPropertyDescriptor(
				HTMLInputElement.prototype,
				'value'
			)!.set!.call(input, '79908');
			input.dispatchEvent(new Event('input', { bubbles: true }));
		});

		await act(async () => {
			container
				.querySelector('form')!
				.dispatchEvent(
					new Event('submit', { bubbles: true, cancelable: true })
				);
		});

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(String(fetchMock.mock.calls[0][0])).toContain(
			'repo=wordpress-develop'
		);
		expect(String(fetchMock.mock.calls[1][0])).toContain('repo=gutenberg');
		expect(container.textContent).toContain('artifact has expired');
	});
});
