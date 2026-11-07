import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProgressTracker } from '@php-wasm/progress';
import type { StartPlaygroundWebOptions } from './index';
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

import {
	startPlaygroundAPI,
	startPlaygroundWeb,
	startPlaygroundWebForApp,
} from './index';

describe('startPlaygroundWeb', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it.each([{ mounts: [] }, { workerMode: 'shared', scope: 'known-site' }])(
		'rejects public storage authority before loading a runtime: %j',
		async (privateOptions) => {
			const iframe = createIframe();
			await expect(
				startPlaygroundWeb({
					iframe,
					remoteUrl: 'http://localhost/remote.html',
					...privateOptions,
				} as unknown as StartPlaygroundWebOptions)
			).rejects.toThrow('startPlaygroundWebForApp');
			expect(iframe.src).toBe('');
		}
	);
	it('rejects shared-runtime URL flags on the public entry point', async () => {
		await expect(
			startPlaygroundWeb({
				iframe: createIframe(),
				remoteUrl:
					'http://localhost/remote.html?shared-worker=1&scope=known-site',
			})
		).rejects.toThrow('startPlaygroundWebForApp');
	});
	it('refuses an app connection from another origin before iframe navigation', async () => {
		const iframe = createIframe();
		await expect(
			startPlaygroundWebForApp({
				iframe,
				remoteUrl: 'https://playground.wordpress.net/remote.html',
			})
		).rejects.toThrow('app-origin embedding document');
		expect(iframe.src).toBe('');
	});
	it('uses the private connection only through the explicit app entry point', async () => {
		mocks.BlueprintsV1Handler.mockImplementation(() => ({
			bootPlayground: mocks.bootPlaygroundV1,
		}));
		const iframe = createIframe();
		await startPlaygroundWebForApp({
			iframe,
			remoteUrl: 'http://localhost/remote.html',
			progressTracker: createProgressTracker(),
			mounts: [],
			workerMode: 'shared',
			scope: 'assigned',
		});
		expect(iframe.src).toContain('/app-runtime.html');
	});

	it('accepts an immutable release endpoint on a compatible origin', async () => {
		mocks.BlueprintsV1Handler.mockImplementation(() => ({
			bootPlayground: mocks.bootPlaygroundV1,
		}));
		mocks.bootPlaygroundV1.mockResolvedValue({ connected: true });
		const iframe = createIframe();
		await startPlaygroundWeb({
			iframe,
			remoteUrl: 'http://localhost/releases/release.A/remote.html',
			progressTracker: createProgressTracker(),
			blueprint: { steps: [] },
		});
		expect(iframe.src).toContain('/releases/release.A/remote.html');
	});

	it.each([
		'http://localhost/releases/release.A/other/remote.html',
		'https://example.com/releases/release.A/remote.html',
	])('rejects an incompatible release endpoint: %s', async (remoteUrl) => {
		await expect(
			startPlaygroundWeb({
				iframe: createIframe(),
				remoteUrl,
				progressTracker: createProgressTracker(),
				blueprint: { steps: [] },
			})
		).rejects.toThrow('Invalid remote URL');
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
				blueprint: {
					steps: [],
				},
			})
		).resolves.toBe(playground);

		expect(mocks.BlueprintsV1Handler).toHaveBeenCalledTimes(1);
		expect(mocks.BlueprintsV2Handler).not.toHaveBeenCalled();
		expect(iframe.src).not.toContain('blueprints-runner');
		expect(iframe.src).toContain('existing=1');
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

describe('startPlaygroundAPI', () => {
	it('rejects a different caller origin before navigating the API frame', async () => {
		const iframe = Object.assign(createIframe(), {
			ownerDocument: {
				defaultView: {
					location: { origin: 'https://wpsandbox.wordpress.net' },
				},
			},
		}) as unknown as HTMLIFrameElement;
		await expect(
			startPlaygroundAPI({
				iframe,
				apiUrl: 'https://playground.wordpress.net/api.html',
			})
		).rejects.toThrow(
			'The saved-site API must be embedded by its app origin.'
		);
		expect(iframe.src).toBe('');
	});

	it.each([
		['a different endpoint', 'http://localhost/remote.html'],
		['an untrusted origin', 'https://example.com/api.html'],
	])('rejects %s', async (_description, apiUrl) => {
		await expect(
			startPlaygroundAPI({
				iframe: createIframe(),
				apiUrl,
			})
		).rejects.toThrow('Invalid API URL');
	});
});

function createIframe() {
	return {
		ownerDocument: {
			defaultView: { location: { origin: 'http://localhost' } },
		},
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
