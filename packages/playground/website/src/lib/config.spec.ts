import { vi } from 'vitest';
import { logger } from '@php-wasm/logger';
import { getRemoteUrl, isExperimentalKandeloEnabled } from './config';

// The default vitest environment for this package is `node`, so we
// stub the few `window` fields the config helpers read.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;

function stubWindow({ search = '', crossOriginIsolated = false } = {}) {
	g.window = {
		location: {
			search,
			origin: 'http://localhost:5400',
		},
		crossOriginIsolated,
	};
}

describe('isExperimentalKandeloEnabled', () => {
	afterEach(() => {
		delete g.window;
		vi.restoreAllMocks();
	});

	it('is false without the query param', () => {
		stubWindow({ crossOriginIsolated: true });
		expect(isExperimentalKandeloEnabled()).toBe(false);
		expect(getRemoteUrl().pathname).toBe('/remote.html');
	});

	it('is true when requested on a cross-origin isolated page', () => {
		stubWindow({
			search: '?experimental=kandelo',
			crossOriginIsolated: true,
		});
		expect(isExperimentalKandeloEnabled()).toBe(true);
		expect(getRemoteUrl().pathname).toBe('/remote-posix-kernel.html');
	});

	it('falls back to the classic runtime with a warning when the page is not cross-origin isolated', () => {
		stubWindow({
			search: '?experimental=kandelo',
			crossOriginIsolated: false,
		});
		const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
		expect(isExperimentalKandeloEnabled()).toBe(false);
		expect(getRemoteUrl().pathname).toBe('/remote.html');
		expect(warn).toHaveBeenCalled();
	});
});
