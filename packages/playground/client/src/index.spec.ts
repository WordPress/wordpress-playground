import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProgressTracker } from '@php-wasm/progress';
import type { BlueprintBundle } from '@wp-playground/blueprints';

const mocks = vi.hoisted(() => {
	vi.stubGlobal('location', {
		href: 'http://localhost/',
		origin: 'http://localhost',
	});
	return {
		bootPlaygroundV1: vi.fn(),
		bootPlaygroundV2: vi.fn(),
		BlueprintsV1Handler: vi.fn(),
		BlueprintsV2Handler: vi.fn(),
		createBlueprintReflection: vi.fn(),
	};
});

vi.mock('@wp-playground/blueprints', () => ({
	BlueprintReflection: {
		create: mocks.createBlueprintReflection,
	},
	isBlueprintBundle: (blueprint: any) => Boolean(blueprint?.read),
}));

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

	it('routes Blueprint v1 declarations through the v1 handler', async () => {
		const playground = { connected: true };
		mocks.BlueprintsV1Handler.mockImplementation(() => ({
			bootPlayground: mocks.bootPlaygroundV1,
		}));
		mocks.bootPlaygroundV1.mockResolvedValue(playground);
		const iframe = createIframe();

		await expect(
			startPlaygroundWeb({
				iframe,
				remoteUrl:
					'http://localhost/remote.html?blueprints-runner=v2&existing=1',
				progressTracker: createProgressTracker(),
				siteName: 'Curious Harbor',
				blueprint: {
					steps: [],
				},
			})
		).resolves.toBe(playground);

		expect(mocks.BlueprintsV1Handler).toHaveBeenCalledTimes(1);
		expect(mocks.BlueprintsV2Handler).not.toHaveBeenCalled();
		expect(iframe.src).not.toContain('blueprints-runner');
		expect(iframe.src).toContain('existing=1');
		expect(new URL(iframe.src).searchParams.get('progressbarTitle')).toBe(
			'Curious Harbor'
		);
	});

	it('routes Blueprint v2 declarations through the v2 handler', async () => {
		const playground = { connected: true };
		mocks.BlueprintsV2Handler.mockImplementation(() => ({
			bootPlayground: mocks.bootPlaygroundV2,
		}));
		mocks.bootPlaygroundV2.mockResolvedValue(playground);
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
		expect(iframe.src).not.toContain('blueprints-runner');
	});

	it('routes Blueprint v2 bundles through the v2 handler', async () => {
		const playground = { connected: true };
		mocks.BlueprintsV2Handler.mockImplementation(() => ({
			bootPlayground: mocks.bootPlaygroundV2,
		}));
		mocks.bootPlaygroundV2.mockResolvedValue(playground);
		mocks.createBlueprintReflection.mockResolvedValueOnce({
			getVersion: () => 2,
		});
		const iframe = createIframe();
		const bundle = {
			read: vi.fn(),
		} satisfies BlueprintBundle;

		await expect(
			startPlaygroundWeb({
				iframe,
				remoteUrl: 'http://localhost/remote.html',
				progressTracker: createProgressTracker(),
				blueprint: bundle,
			})
		).resolves.toBe(playground);

		expect(mocks.createBlueprintReflection).toHaveBeenCalledWith(bundle);
		expect(mocks.BlueprintsV2Handler).toHaveBeenCalledTimes(1);
		expect(mocks.BlueprintsV1Handler).not.toHaveBeenCalled();
		expect(iframe.src).not.toContain('blueprints-runner');
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
