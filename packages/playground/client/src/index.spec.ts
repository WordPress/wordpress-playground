import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProgressTracker } from '@php-wasm/progress';

const mocks = vi.hoisted(() => {
	vi.stubGlobal('location', { origin: 'http://localhost' });
	return {
		bootPlayground: vi.fn(),
		BlueprintsHandler: vi.fn(),
	};
});

vi.mock('./blueprints-handler', () => ({
	BlueprintsHandler: mocks.BlueprintsHandler,
}));

import { startPlaygroundWeb } from './index';

describe('startPlaygroundWeb', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('routes Blueprint declarations through the shared handler', async () => {
		const playground = { connected: true };
		mocks.BlueprintsHandler.mockImplementation(() => ({
			bootPlayground: mocks.bootPlayground,
		}));
		mocks.bootPlayground.mockResolvedValue(playground);
		const iframe = createIframe();

		await expect(
			startPlaygroundWeb({
				iframe,
				remoteUrl: 'http://localhost/remote.html',
				progressTracker: createProgressTracker(),
				blueprint: {
					version: 2,
					siteOptions: {
						blogname: 'V2 site',
					},
				},
			})
		).resolves.toBe(playground);

		expect(mocks.BlueprintsHandler).toHaveBeenCalledTimes(1);
		expect(iframe.src).toContain('blueprints-runner=v1');
	});
});

function createIframe() {
	return {
		src: '',
		addEventListener: vi.fn((_event, callback: () => void) => {
			callback();
		}),
	} as unknown as HTMLIFrameElement;
}

function createProgressTracker() {
	return {
		setCaption: vi.fn(),
		finish: vi.fn(),
	} as unknown as ProgressTracker;
}
