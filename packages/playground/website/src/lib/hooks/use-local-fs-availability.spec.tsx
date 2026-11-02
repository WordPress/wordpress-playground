// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { PlaygroundClient } from '@wp-playground/client';
import { getRemoteUrl } from '../config';
import { useLocalFsAvailability } from './use-local-fs-availability';
import type { LocalFsAvailability } from './use-local-fs-availability';

vi.mock('../config', () => ({ getRemoteUrl: vi.fn() }));

describe('local directory availability', () => {
	let container: HTMLDivElement;
	let root: Root;
	let availability: LocalFsAvailability | null;
	const playground = {
		absoluteUrl: Promise.resolve('http://wp.playground.localhost/scope:site/'),
	} as unknown as PlaygroundClient;

	beforeEach(() => {
		vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
		vi.stubGlobal('showDirectoryPicker', vi.fn());
		vi.mocked(getRemoteUrl).mockReturnValue(
			new URL('/remote.html', window.location.origin)
		);
		container = document.createElement('div');
		document.body.append(container);
		root = createRoot(container);
	});

	afterEach(() => {
		act(() => root.unmount());
		container.remove();
		vi.unstubAllGlobals();
	});

	it('allows directory handles when PHP is same-origin but WordPress is not', async () => {
		await act(async () => root.render(<Probe />));
		expect(availability).toBe('available');
	});

	it('rejects directory handles when the PHP iframe is cross-origin', async () => {
		vi.mocked(getRemoteUrl).mockReturnValue(
			new URL('http://remote.playground.localhost/remote.html')
		);
		await act(async () => root.render(<Probe />));
		expect(availability).toBe('origin-mismatch');
	});

	/** Check the capability through a mounted component, as the save controls do. */
	function Probe() {
		availability = useLocalFsAvailability(playground);
		return null;
	}
});
