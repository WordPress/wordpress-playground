import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProgressTracker } from '@php-wasm/progress';

const mocks = vi.hoisted(() => {
	vi.stubGlobal('location', { origin: 'http://localhost' });
	return {
		v1BootPlayground: vi.fn(),
		v2BootPlayground: vi.fn(),
		BlueprintsV1Handler: vi.fn(),
		BlueprintsV2Handler: vi.fn(),
	};
});

vi.mock('./blueprints-v1-handler', () => ({
	BlueprintsV1Handler: mocks.BlueprintsV1Handler,
}));

vi.mock('./blueprints-v2-handler', () => ({
	BlueprintsV2Handler: mocks.BlueprintsV2Handler,
}));

import { startPlaygroundWeb } from './index';

describe('startPlaygroundWeb', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('routes v2 declarations through the native v2 handler by default', async () => {
		const playground = { connected: true };
		mocks.BlueprintsV1Handler.mockImplementation(() => ({
			bootPlayground: mocks.v1BootPlayground,
		}));
		mocks.BlueprintsV2Handler.mockImplementation(() => ({
			bootPlayground: mocks.v2BootPlayground,
		}));
		mocks.v2BootPlayground.mockResolvedValue(playground);
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

		expect(mocks.BlueprintsV2Handler).toHaveBeenCalledTimes(1);
		expect(mocks.BlueprintsV1Handler).not.toHaveBeenCalled();
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
