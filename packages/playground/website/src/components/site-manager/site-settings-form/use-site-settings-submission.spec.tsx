// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { SiteFormData } from './unconnected-site-settings-form';
import { useSiteSettingsSubmission } from './use-site-settings-submission';

const formData: SiteFormData = {
	phpVersion: '8.3',
	wpVersion: 'latest',
	language: '',
	withNetworking: true,
	multisite: false,
};

describe('useSiteSettingsSubmission', () => {
	let container: HTMLDivElement;
	let root: Root;
	let state: ReturnType<typeof useSiteSettingsSubmission>;

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

	it('notifies on submit and rejects a second submission before React can paint', async () => {
		let finish!: () => void;
		const action = vi.fn(
			() => new Promise<void>((resolve) => (finish = resolve))
		);
		const onSubmit = vi.fn();
		act(() => root.render(<Probe onSubmit={onSubmit} />));

		let first!: Promise<void>;
		let second!: Promise<void>;
		act(() => {
			first = state.run(action, formData);
			second = state.run(action, formData);
		});

		expect(action).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(state.isPending).toBe(true);
		await second;
		await act(async () => {
			finish();
			await first;
		});
		expect(state.isPending).toBe(false);
		expect(onSubmit).toHaveBeenCalledTimes(1);
	});

	it('keeps a failure on the form and permits a retry', async () => {
		const action = vi
			.fn<(_: SiteFormData) => Promise<void>>()
			.mockRejectedValueOnce(new Error('Browser storage is full.'))
			.mockResolvedValueOnce();
		const onSubmit = vi.fn();
		act(() => root.render(<Probe onSubmit={onSubmit} />));

		await act(() => state.run(action, formData));
		expect(state.error).toBe('Browser storage is full.');
		expect(state.isPending).toBe(false);
		expect(onSubmit).toHaveBeenCalledTimes(1);

		await act(() => state.run(action, formData));
		expect(state.error).toBeUndefined();
		expect(onSubmit).toHaveBeenCalledTimes(2);
	});

	it('does not report an onSubmit failure as a submission failure', async () => {
		const action = vi
			.fn<(_: SiteFormData) => Promise<void>>()
			.mockResolvedValue();
		const onSubmit = vi.fn(() => {
			throw new Error('Could not close the settings panel.');
		});
		act(() => root.render(<Probe onSubmit={onSubmit} />));

		await expect(act(() => state.run(action, formData))).rejects.toThrow(
			'Could not close the settings panel.'
		);
		expect(action).not.toHaveBeenCalled();
		expect(state.error).toBeUndefined();
		expect(state.isPending).toBe(false);
	});

	function Probe({ onSubmit }: { onSubmit: () => void }) {
		state = useSiteSettingsSubmission(onSubmit);
		return null;
	}
});
