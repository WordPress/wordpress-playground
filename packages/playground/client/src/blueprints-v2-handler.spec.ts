import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgressTracker } from '@php-wasm/progress';
import { BlueprintsV2Handler } from './blueprints-v2-handler';

const mocks = vi.hoisted(() => {
	return {
		playground: {
			boot: vi.fn(),
			isConnected: vi.fn(),
			isReady: vi.fn(),
			onDownloadProgress: vi.fn(),
		},
		compileBlueprintV2: vi.fn(),
		hasBlueprintV2WordPressZipReference: vi.fn(),
		runBlueprintV2Steps: vi.fn(),
		resolveBlueprintV2WordPressSource: vi.fn(),
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

vi.mock('@wp-playground/blueprints', () => ({
	BlueprintReflection: {
		create: mocks.createBlueprintReflection,
	},
	compileBlueprintV2: mocks.compileBlueprintV2,
	hasBlueprintV2WordPressZipReference:
		mocks.hasBlueprintV2WordPressZipReference,
	runBlueprintV2Steps: mocks.runBlueprintV2Steps,
	resolveBlueprintV2WordPressSource: mocks.resolveBlueprintV2WordPressSource,
	resolveRuntimeConfiguration: mocks.resolveRuntimeConfiguration,
}));

describe('BlueprintsV2Handler', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.playground.boot.mockResolvedValue(undefined);
		mocks.playground.isConnected.mockResolvedValue(undefined);
		mocks.playground.isReady.mockResolvedValue(undefined);
		mocks.playground.onDownloadProgress.mockResolvedValue(undefined);
		mocks.compileBlueprintV2.mockResolvedValue({ compiled: true });
		mocks.hasBlueprintV2WordPressZipReference.mockResolvedValue(false);
		mocks.runBlueprintV2Steps.mockResolvedValue(undefined);
		mocks.resolveRuntimeConfiguration.mockResolvedValue({
			phpVersion: '8.2',
			wpVersion: '6.4',
			intl: true,
			networking: false,
		});
		mocks.resolveBlueprintV2WordPressSource.mockResolvedValue({
			wpVersion: '6.4',
		});
		mocks.createBlueprintReflection.mockImplementation(
			async (blueprint) => ({
				getVersion: () => ((blueprint as any)?.version === 2 ? 2 : 1),
				getDeclaration: () => blueprint,
			})
		);
		mocks.consumeAPI.mockReturnValue(mocks.playground);
	});

	it('boots and runs the native v2 compiler path', async () => {
		const iframe = createIframe();
		const onBlueprintValidated = vi.fn();
		const onBlueprintStepCompleted = vi.fn();
		const onClientConnected = vi.fn();
		const blueprint = {
			version: 2,
			siteOptions: {
				blogname: 'V2 site',
			},
		};
		const handler = new BlueprintsV2Handler({
			iframe,
			remoteUrl: 'http://example.com/remote.html',
			blueprint,
			scope: 'test-scope',
			corsProxy: 'https://cors.example.test/proxy',
			onBlueprintValidated,
			onBlueprintStepCompleted,
			onClientConnected,
		});

		await handler.bootPlayground(iframe, createProgressTracker());

		expect(mocks.resolveRuntimeConfiguration).toHaveBeenCalledWith(
			blueprint
		);
		expect(mocks.resolveBlueprintV2WordPressSource).toHaveBeenCalledWith(
			blueprint,
			expect.objectContaining({
				corsProxy: 'https://cors.example.test/proxy',
			})
		);
		expect(mocks.playground.boot).toHaveBeenCalledWith(
			expect.objectContaining({
				scope: 'test-scope',
				phpVersion: '8.2',
				wpVersion: '6.4',
				extensions: ['intl'],
				withNetworking: false,
				corsProxyUrl: 'https://cors.example.test/proxy',
				wordpressInstallMode: 'download-and-install',
			})
		);
		expect(mocks.compileBlueprintV2).toHaveBeenCalledWith(
			blueprint,
			expect.objectContaining({
				onBlueprintValidated,
				onStepCompleted: onBlueprintStepCompleted,
				corsProxy: 'https://cors.example.test/proxy',
			})
		);
		expect(mocks.runBlueprintV2Steps).toHaveBeenCalledWith(
			{ compiled: true },
			mocks.playground
		);
		expect(onClientConnected).toHaveBeenCalledWith(mocks.playground);
	});

	it('rejects custom WordPress ZIP sources outside new-site installs', async () => {
		const iframe = createIframe();
		mocks.hasBlueprintV2WordPressZipReference.mockResolvedValue(true);
		const handler = new BlueprintsV2Handler({
			iframe,
			remoteUrl: 'http://example.com/remote.html',
			blueprint: {
				version: 2,
				wordpressVersion: 'https://example.com/wordpress.zip',
			},
			wordpressInstallMode: 'install-from-existing-files-if-needed',
		});

		await expect(
			handler.bootPlayground(iframe, createProgressTracker())
		).rejects.toThrow(
			'Blueprint v2 wordpressVersion ZIP references can only be used when creating a new site.'
		);
		expect(mocks.playground.boot).not.toHaveBeenCalled();
		expect(mocks.resolveBlueprintV2WordPressSource).not.toHaveBeenCalled();
	});

	it('preserves v1 preferredVersions.wp false when using the native v2 path', async () => {
		const iframe = createIframe();
		const blueprint = {
			preferredVersions: {
				php: 'latest',
				wp: false,
			},
			steps: [],
		} as any;
		const handler = new BlueprintsV2Handler({
			iframe,
			remoteUrl: 'http://example.com/remote.html',
			blueprint,
		});

		await handler.bootPlayground(iframe, createProgressTracker());

		expect(mocks.playground.boot).toHaveBeenCalledWith(
			expect.objectContaining({
				wordpressInstallMode: 'do-not-attempt-installing',
			})
		);
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
