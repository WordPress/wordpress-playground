import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgressTracker } from '@php-wasm/progress';
import { BlueprintsV1Handler } from './blueprints-v1-handler';

const mocks = vi.hoisted(() => {
	return {
		playground: {
			boot: vi.fn(),
			isConnected: vi.fn(),
			isReady: vi.fn(),
			onDownloadProgress: vi.fn(),
			prefetchUpdateChecks: vi.fn(),
		},
		compileBlueprintV1: vi.fn(),
		isBlueprintBundle: vi.fn(),
		runBlueprintV1Steps: vi.fn(),
		resolveRuntimeConfiguration: vi.fn(),
		createBlueprintReflection: vi.fn(),
		consumeAPI: vi.fn(),
		collectPhpLogs: vi.fn(),
	};
});

vi.mock('@php-wasm/logger', () => ({
	collectPhpLogs: mocks.collectPhpLogs,
	logger: {},
}));

vi.mock('@php-wasm/universal', () => ({
	consumeAPI: mocks.consumeAPI,
}));

vi.mock('.', () => ({
	BlueprintReflection: {
		create: mocks.createBlueprintReflection,
	},
	compileBlueprintV1: mocks.compileBlueprintV1,
	isBlueprintBundle: mocks.isBlueprintBundle,
	runBlueprintV1Steps: mocks.runBlueprintV1Steps,
	resolveRuntimeConfiguration: mocks.resolveRuntimeConfiguration,
}));

describe('BlueprintsV1Handler', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.playground.boot.mockResolvedValue(undefined);
		mocks.playground.isConnected.mockResolvedValue(undefined);
		mocks.playground.isReady.mockResolvedValue(undefined);
		mocks.playground.onDownloadProgress.mockResolvedValue(undefined);
		mocks.playground.prefetchUpdateChecks.mockResolvedValue(undefined);
		mocks.compileBlueprintV1.mockResolvedValue([]);
		mocks.isBlueprintBundle.mockReturnValue(false);
		mocks.runBlueprintV1Steps.mockResolvedValue(undefined);
		mocks.resolveRuntimeConfiguration.mockResolvedValue({
			phpVersion: '8.4',
			wpVersion: 'latest',
			intl: false,
			// Most tests below do not exercise update-check prefetching.
			// Keep networking disabled by default so the deferred prefetch
			// does not enqueue timers in unrelated tests. Prefetch-specific
			// tests opt in explicitly.
			networking: false,
		});
		mocks.createBlueprintReflection.mockResolvedValue({
			getVersion: () => 1,
		});
		mocks.consumeAPI.mockReturnValue(mocks.playground);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('does not prefetch WordPress updates for PHP-only blueprints', async () => {
		const iframe = createIframe();
		const handler = new BlueprintsV1Handler({
			iframe,
			remoteUrl: 'http://example.com/remote.html',
			blueprint: {
				preferredVersions: {
					php: '8.4',
					wp: false,
				},
			},
		});

		await handler.bootPlayground(iframe, createProgressTracker());

		expect(mocks.playground.boot).toHaveBeenCalledWith(
			expect.objectContaining({
				wordpressInstallMode: 'do-not-attempt-installing',
			})
		);
		expect(mocks.playground.prefetchUpdateChecks).not.toHaveBeenCalled();
	});

	it('boots WordPress setup when only installation is disabled', async () => {
		const iframe = createIframe();
		const progressTracker = createProgressTracker();
		const handler = new BlueprintsV1Handler({
			iframe,
			remoteUrl: 'http://example.com/remote.html',
			blueprint: {},
			shouldInstallWordPress: false,
		});

		await handler.bootPlayground(iframe, progressTracker);

		expect(mocks.playground.boot).toHaveBeenCalledWith(
			expect.objectContaining({
				wordpressInstallMode: 'install-from-existing-files-if-needed',
			})
		);
		expect(progressTracker.pipe).toHaveBeenCalledWith(mocks.playground);
	});

	it('does not pipe progress to the remote when progress bar is disabled', async () => {
		const iframe = createIframe();
		const progressTracker = createProgressTracker();
		const handler = new BlueprintsV1Handler({
			iframe,
			remoteUrl: 'http://example.com/remote.html',
			blueprint: {},
			disableProgressBar: true,
		});

		await handler.bootPlayground(iframe, progressTracker);

		expect(progressTracker.pipe).not.toHaveBeenCalled();
	});

	it('passes query API PHP extension requests to the runtime', async () => {
		mocks.resolveRuntimeConfiguration.mockResolvedValue({
			phpVersion: '8.4',
			wpVersion: 'latest',
			intl: true,
			// This test only verifies PHP extension selection. Keep networking
			// disabled so update-check prefetching remains outside its scope.
			networking: false,
		});
		const iframe = createIframe();
		const handler = new BlueprintsV1Handler({
			iframe,
			remoteUrl: 'http://example.com/remote.html',
			blueprint: {},
			extensions: [
				{
					source: {
						format: 'manifest',
						manifestUrl:
							'https://cdn.example.com/spx/manifest.json',
					},
				},
			],
		});

		await handler.bootPlayground(iframe, createProgressTracker());

		expect(mocks.playground.boot).toHaveBeenCalledWith(
			expect.objectContaining({
				extensions: [
					'intl',
					{
						source: {
							format: 'manifest',
							manifestUrl:
								'https://cdn.example.com/spx/manifest.json',
						},
					},
				],
			})
		);
	});

	it('does not install WordPress when installation is disabled', async () => {
		const iframe = createIframe();
		const handler = new BlueprintsV1Handler({
			iframe,
			remoteUrl: 'http://example.com/remote.html',
			blueprint: {},
			wordpressInstallMode: 'do-not-attempt-installing',
		});

		await handler.bootPlayground(iframe, createProgressTracker());

		expect(mocks.playground.boot).toHaveBeenCalledWith(
			expect.objectContaining({
				wordpressInstallMode: 'do-not-attempt-installing',
			})
		);
		expect(mocks.playground.prefetchUpdateChecks).not.toHaveBeenCalled();
	});

	it('rejects WordPress install mode for PHP-only blueprints', async () => {
		const iframe = createIframe();
		const handler = new BlueprintsV1Handler({
			iframe,
			remoteUrl: 'http://example.com/remote.html',
			blueprint: {
				preferredVersions: {
					php: '8.4',
					wp: false,
				},
			},
			wordpressInstallMode: 'download-and-install',
		});

		await expect(
			handler.bootPlayground(iframe, createProgressTracker())
		).rejects.toThrow(
			'Conflicting options: WordPress was requested, ' +
				'but the Blueprint sets ' +
				'`preferredVersions.wp: false`. Pick one.'
		);
		expect(mocks.playground.boot).not.toHaveBeenCalled();
	});

	it('rejects WordPress installation for PHP-only blueprints', async () => {
		const iframe = createIframe();
		const handler = new BlueprintsV1Handler({
			iframe,
			remoteUrl: 'http://example.com/remote.html',
			blueprint: {
				preferredVersions: {
					php: '8.4',
					wp: false,
				},
			},
			shouldInstallWordPress: true,
		});

		await expect(
			handler.bootPlayground(iframe, createProgressTracker())
		).rejects.toThrow(
			'Conflicting options: WordPress was requested, ' +
				'but the Blueprint sets ' +
				'`preferredVersions.wp: false`. Pick one.'
		);
		expect(mocks.playground.boot).not.toHaveBeenCalled();
	});

	it('defers WordPress update prefetch for frontend landing pages', async () => {
		mocks.resolveRuntimeConfiguration.mockResolvedValue({
			phpVersion: '8.4',
			wpVersion: 'latest',
			intl: false,
			networking: true,
		});
		vi.useFakeTimers();
		vi.stubGlobal('requestIdleCallback', undefined);
		const iframe = createIframe();
		const handler = new BlueprintsV1Handler({
			iframe,
			remoteUrl: 'http://example.com/remote.html',
			blueprint: {},
		});

		await handler.bootPlayground(iframe, createProgressTracker());

		expect(mocks.playground.boot).toHaveBeenCalledWith(
			expect.objectContaining({
				wordpressInstallMode: 'download-and-install',
			})
		);
		expect(mocks.playground.prefetchUpdateChecks).not.toHaveBeenCalled();

		await vi.runAllTimersAsync();

		expect(mocks.playground.prefetchUpdateChecks).toHaveBeenCalledTimes(1);
		vi.useRealTimers();
	});

	it('does not treat wp-admin-prefixed frontend paths as admin landings', async () => {
		mocks.resolveRuntimeConfiguration.mockResolvedValue({
			phpVersion: '8.4',
			wpVersion: 'latest',
			intl: false,
			networking: true,
		});
		vi.useFakeTimers();
		vi.stubGlobal('requestIdleCallback', undefined);
		const iframe = createIframe();
		const handler = new BlueprintsV1Handler({
			iframe,
			remoteUrl: 'http://example.com/remote.html',
			blueprint: {
				landingPage: '/wp-adminer',
			},
		});

		await handler.bootPlayground(iframe, createProgressTracker());

		expect(mocks.playground.prefetchUpdateChecks).not.toHaveBeenCalled();

		await vi.runAllTimersAsync();

		expect(mocks.playground.prefetchUpdateChecks).toHaveBeenCalledTimes(1);
		vi.useRealTimers();
	});

	it('prefetches WordPress updates before admin landing pages', async () => {
		mocks.resolveRuntimeConfiguration.mockResolvedValue({
			phpVersion: '8.4',
			wpVersion: 'latest',
			intl: false,
			networking: true,
		});
		const iframe = createIframe();
		const handler = new BlueprintsV1Handler({
			iframe,
			remoteUrl: 'http://example.com/remote.html',
			blueprint: {
				landingPage: '/wp-admin/',
			},
		});

		await handler.bootPlayground(iframe, createProgressTracker());

		expect(mocks.playground.boot).toHaveBeenCalledWith(
			expect.objectContaining({
				wordpressInstallMode: 'download-and-install',
			})
		);
		expect(mocks.playground.prefetchUpdateChecks).toHaveBeenCalledTimes(1);
	});
});

function createIframe() {
	return {
		contentWindow: {},
		ownerDocument: {
			defaultView: {},
		},
	} as HTMLIFrameElement;
}

function createProgressTracker() {
	const child = {
		finish: vi.fn(),
		loadingListener: vi.fn(),
	};
	return {
		pipe: vi.fn(),
		stage: vi.fn(() => child),
	} as unknown as ProgressTracker;
}
