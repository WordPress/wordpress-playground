import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProgressTracker } from '@php-wasm/progress';

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
		consumeAPI: vi.fn(),
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

vi.mock('@php-wasm/universal', async (importActual) => {
	const actual = await importActual();
	return {
		...(actual as object),
		consumeAPI: mocks.consumeAPI,
	};
});

import { startOpfsBridge, startPlaygroundWeb } from './index';

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
				remoteUrl: 'http://localhost/remote.html',
				progressTracker: createProgressTracker(),
				blueprint: {
					steps: [],
				},
			})
		).resolves.toBe(playground);

		expect(mocks.BlueprintsV1Handler).toHaveBeenCalledTimes(1);
		expect(mocks.BlueprintsV2Handler).not.toHaveBeenCalled();
		expect(iframe.src).toContain('blueprints-runner=v1');
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
		expect(iframe.src).toContain('blueprints-runner=v1');
	});

	it('loads the OPFS bridge iframe and returns the bridge API', async () => {
		const bridge = {
			isConnected: vi.fn(async () => undefined),
			isReady: vi.fn(async () => undefined),
			zipSite: vi.fn(),
		};
		mocks.consumeAPI.mockReturnValue(bridge);
		const iframe = createIframe();

		await expect(startOpfsBridge({ iframe })).resolves.toBe(bridge);

		expect(iframe.src).toBe('http://localhost/bridge.html');
		expect(mocks.consumeAPI).toHaveBeenCalledWith(
			iframe.contentWindow,
			iframe.ownerDocument!.defaultView
		);
		expect(bridge.isConnected).toHaveBeenCalledTimes(1);
		expect(bridge.isReady).toHaveBeenCalledTimes(1);
	});

	it('requires OPFS bridge URLs to point to bridge.html', async () => {
		const iframe = createIframe();

		await expect(
			startOpfsBridge({
				iframe,
				bridgeUrl: 'http://localhost/remote.html',
			})
		).rejects.toThrow('/bridge.html');
	});
});

function createIframe() {
	return {
		src: '',
		contentWindow: {},
		ownerDocument: {
			defaultView: {},
		},
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
