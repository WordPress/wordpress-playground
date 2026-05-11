import { beforeEach, describe, expect, it, vi } from 'vitest';
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
			networking: true,
		});
		mocks.createBlueprintReflection.mockResolvedValue({
			getVersion: () => 1,
		});
		mocks.consumeAPI.mockReturnValue(mocks.playground);
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
				shouldBootWordPress: false,
				shouldInstallWordPress: false,
			})
		);
		expect(mocks.playground.prefetchUpdateChecks).not.toHaveBeenCalled();
	});

	it('boots WordPress setup when only installation is disabled', async () => {
		const iframe = createIframe();
		const handler = new BlueprintsV1Handler({
			iframe,
			remoteUrl: 'http://example.com/remote.html',
			blueprint: {},
			shouldInstallWordPress: false,
		});

		await handler.bootPlayground(iframe, createProgressTracker());

		expect(mocks.playground.boot).toHaveBeenCalledWith(
			expect.objectContaining({
				shouldBootWordPress: true,
				shouldInstallWordPress: false,
			})
		);
	});

	it('does not install WordPress when boot is explicitly disabled', async () => {
		const iframe = createIframe();
		const handler = new BlueprintsV1Handler({
			iframe,
			remoteUrl: 'http://example.com/remote.html',
			blueprint: {},
			shouldBootWordPress: false,
		});

		await handler.bootPlayground(iframe, createProgressTracker());

		expect(mocks.playground.boot).toHaveBeenCalledWith(
			expect.objectContaining({
				shouldBootWordPress: false,
				shouldInstallWordPress: false,
			})
		);
		expect(mocks.playground.prefetchUpdateChecks).not.toHaveBeenCalled();
	});

	it('rejects WordPress installation when boot is disabled', async () => {
		const iframe = createIframe();
		const handler = new BlueprintsV1Handler({
			iframe,
			remoteUrl: 'http://example.com/remote.html',
			blueprint: {},
			shouldBootWordPress: false,
			shouldInstallWordPress: true,
		});

		await expect(
			handler.bootPlayground(iframe, createProgressTracker())
		).rejects.toThrow(
			'Conflicting options: WordPress installation was requested, ' +
				'but WordPress boot was disabled. Pick one.'
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
			'Conflicting options: WordPress install or boot was requested, ' +
				'but the Blueprint sets ' +
				'`preferredVersions.wp: false`. Pick one.'
		);
		expect(mocks.playground.boot).not.toHaveBeenCalled();
	});

	it('prefetches WordPress updates when WordPress is installed', async () => {
		const iframe = createIframe();
		const handler = new BlueprintsV1Handler({
			iframe,
			remoteUrl: 'http://example.com/remote.html',
			blueprint: {},
		});

		await handler.bootPlayground(iframe, createProgressTracker());

		expect(mocks.playground.boot).toHaveBeenCalledWith(
			expect.objectContaining({
				shouldInstallWordPress: true,
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
