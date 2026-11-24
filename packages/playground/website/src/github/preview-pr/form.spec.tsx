// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import PreviewPRForm from './form';

vi.mock('@wordpress/components', () => ({
	Button: ({
		children,
		variant: _variant,
		...props
	}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
		variant?: string;
	}) => <button {...props}>{children}</button>,
	Notice: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
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
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('checks both repositories before resolving a bare PR number', async () => {
		const fetchMock = vi.fn((input: RequestInfo | URL) => {
			const url = String(input);
			const error = url.includes('repo=gutenberg')
				? 'artifact_expired'
				: 'invalid_pr_number';
			return Promise.resolve(verificationError(error));
		});
		vi.stubGlobal('fetch', fetchMock);

		await renderAndSubmit('79908');

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(String(fetchMock.mock.calls[0][0])).toContain(
			'repo=wordpress-develop'
		);
		expect(String(fetchMock.mock.calls[1][0])).toContain('repo=gutenberg');
		expect(container.textContent).toContain('artifact has expired');
	});

	it('offers a repository choice when both repositories match', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn((input: RequestInfo | URL) => {
				const isGutenberg = String(input).includes('repo=gutenberg');
				return Promise.resolve(
					verificationSuccess(
						isGutenberg
							? 'Add a command palette to the editor'
							: 'Preserve HTML text boundaries',
						isGutenberg
							? '2026-07-18T14:45:00Z'
							: '2026-06-12T09:30:00Z'
					)
				);
			})
		);

		await renderAndSubmit('79908');

		const actions = Array.from(container.querySelectorAll('button'));
		expect(actions).toHaveLength(2);
		expect(actions[0].textContent).toContain('wordpress/wordpress-develop');
		expect(actions[0].textContent).toContain('PR #79908');
		expect(actions[0].textContent).toContain(
			'Preserve HTML text boundaries'
		);
		expect(actions[0].textContent).toContain('opened 2026-06-12');
		expect(actions[1].textContent).toContain('wordpress/gutenberg');
		expect(actions[1].textContent).toContain('PR #79908');
		expect(actions[1].textContent).toContain(
			'Add a command palette to the editor'
		);
		expect(actions[1].textContent).toContain('opened 2026-07-18');
	});

	it('describes pull requests opened today or yesterday', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 6, 21, 23, 0));
		const openedToday = new Date(2026, 6, 21, 22, 48).toISOString();
		const openedYesterday = new Date(2026, 6, 20, 10, 15).toISOString();
		vi.stubGlobal(
			'fetch',
			vi.fn((input: RequestInfo | URL) => {
				const isGutenberg = String(input).includes('repo=gutenberg');
				return Promise.resolve(
					verificationSuccess(
						isGutenberg ? 'Gutenberg change' : 'Core change',
						isGutenberg ? openedYesterday : openedToday
					)
				);
			})
		);

		await renderAndSubmit('79908');

		const actions = Array.from(container.querySelectorAll('button'));
		expect(actions[0].textContent).toContain('opened today 10:48pm');
		expect(actions[1].textContent).toContain('opened yesterday at 10:15am');
	});

	it('names both repositories when neither repository matches', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(() => Promise.resolve(verificationError('invalid_pr_number')))
		);

		await renderAndSubmit('79908');

		expect(container.textContent).toContain(
			'Couldn’t find PR 79908 in WordPress Core or Gutenberg.'
		);
	});

	it('reports a verification failure instead of a missing PR', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response('Bad gateway', { status: 502 }))
			.mockResolvedValueOnce(verificationError('invalid_pr_number'));
		vi.stubGlobal('fetch', fetchMock);

		await renderAndSubmit('79908');

		expect(container.textContent).toContain(
			'Playground couldn’t check GitHub right now.'
		);
		expect(container.textContent).not.toContain('Couldn’t find PR');
	});

	async function renderAndSubmit(value: string) {
		act(() => {
			root.render(<PreviewPRForm inline onClose={() => {}} />);
		});
		const input = container.querySelector('input')!;
		act(() => {
			Object.getOwnPropertyDescriptor(
				HTMLInputElement.prototype,
				'value'
			)!.set!.call(input, value);
			input.dispatchEvent(new Event('input', { bubbles: true }));
		});

		await act(async () => {
			container
				.querySelector('form')!
				.dispatchEvent(
					new Event('submit', { bubbles: true, cancelable: true })
				);
		});
	}

	function verificationError(
		error: string,
		title?: string,
		openedAt?: string
	) {
		return new Response(
			JSON.stringify({ error, title, created_at: openedAt }),
			{
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	}

	function verificationSuccess(title: string, openedAt: string) {
		return new Response(JSON.stringify({ title, created_at: openedAt }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	}
});
