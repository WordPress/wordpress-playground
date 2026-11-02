// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { TransferProgressView } from './transfer-progress';

it('advances by bytes within one large file and exposes the same value to assistive technology', async () => {
	vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
	const container = document.createElement('div');
	const root = createRoot(container);
	try {
		await act(async () =>
			root.render(
				<TransferProgressView
					progress={{
						message: 'Downloading site files',
						bytesDone: 1024,
						bytesTotal: 4096,
						filesDone: 0,
						filesTotal: 1,
					}}
				/>
			)
		);
		expect(container.querySelector('progress')?.value).toBe(25);
		expect(container.textContent).toContain('1 KB / 4 KB');
		await act(async () =>
			root.render(
				<TransferProgressView
					progress={{
						message: 'Downloading site files',
						bytesDone: 3072,
						bytesTotal: 4096,
						filesDone: 0,
						filesTotal: 1,
					}}
				/>
			)
		);
		expect(container.querySelector('progress')?.value).toBe(75);
		expect(
			container.querySelector('progress')?.getAttribute('aria-label')
		).toBe('Downloading site files');
		expect(container.textContent).toContain('0 / 1 files');
	} finally {
		await act(async () => root.unmount());
		vi.unstubAllGlobals();
	}
});

it('keeps the overall bar during installation without a byte total', async () => {
	vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
	const container = document.createElement('div');
	const root = createRoot(container);
	try {
		await act(async () =>
			root.render(
				<TransferProgressView
					progress={{
						message: 'Installing the site',
						overallPercent: 92,
					}}
				/>
			)
		);
		expect(container.querySelector('progress')?.value).toBe(92);
		await act(async () =>
			root.render(
				<TransferProgressView
					progress={{
						message: 'Downloading SQL',
						overallPercent: 62.5,
						bytesDone: 1024,
					}}
				/>
			)
		);
		expect(container.querySelector('progress')?.value).toBe(62.5);
		expect(container.textContent).toContain('1 KB');
		expect(container.textContent).not.toContain(' / ');
	} finally {
		await act(async () => root.unmount());
		vi.unstubAllGlobals();
	}
});
