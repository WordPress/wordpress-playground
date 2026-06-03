import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgressTracker } from '@php-wasm/progress';
import { BlueprintsHandler } from './blueprints-handler';

const mocks = vi.hoisted(() => {
	return {
		playground: {
			boot: vi.fn(),
			isConnected: vi.fn(),
			isReady: vi.fn(),
			onDownloadProgress: vi.fn(),
			prefetchUpdateChecks: vi.fn(),
		},
		compileBlueprintForExecution: vi.fn(),
		hasBlueprintV2WordPressZipReference: vi.fn(),
		resolveBlueprintV2WordPressSource: vi.fn(),
		resolveRuntimeConfiguration: vi.fn(),
		createBlueprintReflection: vi.fn(),
		consumeAPI: vi.fn(),
		collectPhpLogs: vi.fn(),
		compiledRun: vi.fn(),
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
	compileBlueprintForExecution: mocks.compileBlueprintForExecution,
	hasBlueprintV2WordPressZipReference:
		mocks.hasBlueprintV2WordPressZipReference,
	resolveBlueprintV2WordPressSource: mocks.resolveBlueprintV2WordPressSource,
	resolveRuntimeConfiguration: mocks.resolveRuntimeConfiguration,
}));

describe('BlueprintsHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.playground.boot.mockResolvedValue(undefined);
		mocks.playground.isConnected.mockResolvedValue(undefined);
		mocks.playground.isReady.mockResolvedValue(undefined);
		mocks.playground.onDownloadProgress.mockResolvedValue(undefined);
		mocks.playground.prefetchUpdateChecks.mockResolvedValue(undefined);
		mocks.compiledRun.mockResolvedValue(undefined);
		mocks.compileBlueprintForExecution.mockImplementation(
			async (blueprint) => ({
				version: (blueprint as any)?.version === 2 ? 2 : 1,
				declaration: blueprint,
				compiled: {},
				run: mocks.compiledRun,
			})
		);
		mocks.hasBlueprintV2WordPressZipReference.mockResolvedValue(false);
		mocks.resolveBlueprintV2WordPressSource.mockResolvedValue({
			wpVersion: '6.4',
		});
		mocks.resolveRuntimeConfiguration.mockResolvedValue({
			phpVersion: '8.4',
			wpVersion: 'latest',
			intl: false,
			networking: true,
		});
		mocks.createBlueprintReflection.mockImplementation(
			async (blueprint) => ({
				getVersion: () => ((blueprint as any)?.version === 2 ? 2 : 1),
				getDeclaration: () => blueprint,
			})
		);
		mocks.consumeAPI.mockReturnValue(mocks.playground);
	});

	it('does not prefetch WordPress updates for PHP-only v1 blueprints', async () => {
		const iframe = createIframe();
		const blueprint = {
			preferredVersions: {
				php: '8.4' as const,
				wp: false as const,
			},
			steps: [],
		};
		const handler = new BlueprintsHandler({
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
		expect(mocks.compiledRun).toHaveBeenCalledWith(mocks.playground);
		expect(mocks.playground.prefetchUpdateChecks).not.toHaveBeenCalled();
	});

	it('preserves PHP-only mode for Blueprint v1 bundles', async () => {
		const iframe = createIframe();
		const bundle = {
			read: vi.fn(),
		};
		mocks.compileBlueprintForExecution.mockResolvedValue({
			version: 1,
			declaration: {
				preferredVersions: {
					php: '8.4',
					wp: false,
				},
				steps: [],
			},
			compiled: {},
			run: mocks.compiledRun,
		});
		const handler = new BlueprintsHandler({
			iframe,
			remoteUrl: 'http://example.com/remote.html',
			blueprint: bundle as any,
		});

		await handler.bootPlayground(iframe, createProgressTracker());

		expect(mocks.playground.boot).toHaveBeenCalledWith(
			expect.objectContaining({
				wordpressInstallMode: 'do-not-attempt-installing',
			})
		);
		expect(mocks.playground.prefetchUpdateChecks).not.toHaveBeenCalled();
	});

	it('boots and runs Blueprint v2 declarations through the shared handler', async () => {
		mocks.resolveRuntimeConfiguration.mockResolvedValue({
			phpVersion: '8.2',
			wpVersion: '6.4',
			intl: true,
			networking: false,
		});
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
		const handler = new BlueprintsHandler({
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
		expect(mocks.compileBlueprintForExecution).toHaveBeenCalledWith(
			blueprint,
			expect.objectContaining({
				executionPath: undefined,
				onBlueprintValidated,
				onStepCompleted: onBlueprintStepCompleted,
				corsProxy: 'https://cors.example.test/proxy',
			})
		);
		expect(mocks.compiledRun).toHaveBeenCalledWith(mocks.playground);
		expect(onClientConnected).toHaveBeenCalledWith(mocks.playground);
	});

	it('rejects custom WordPress ZIP sources outside new-site installs', async () => {
		const iframe = createIframe();
		mocks.compileBlueprintForExecution.mockResolvedValue({
			version: 2,
			declaration: {
				version: 2,
				wordpressVersion: 'https://example.com/wordpress.zip',
			},
			compiled: {},
			run: mocks.compiledRun,
		});
		mocks.hasBlueprintV2WordPressZipReference.mockResolvedValue(true);
		const handler = new BlueprintsHandler({
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
		expect(mocks.compiledRun).not.toHaveBeenCalled();
	});

	it('uses the original bundle when resolving custom WordPress ZIP sources', async () => {
		const iframe = createIframe();
		const bundle = {
			read: vi.fn(),
		};
		const compiledDeclaration = {
			version: 2,
			wordpressVersion: './wordpress.zip',
		};
		mocks.compileBlueprintForExecution.mockResolvedValue({
			version: 2,
			declaration: compiledDeclaration,
			compiled: {},
			run: mocks.compiledRun,
		});
		const handler = new BlueprintsHandler({
			iframe,
			remoteUrl: 'http://example.com/remote.html',
			blueprint: bundle as any,
			corsProxy: 'https://cors.example.test/proxy',
		});

		await handler.bootPlayground(iframe, createProgressTracker());

		expect(mocks.resolveRuntimeConfiguration).toHaveBeenCalledWith(
			compiledDeclaration
		);
		expect(mocks.resolveBlueprintV2WordPressSource).toHaveBeenCalledWith(
			bundle,
			expect.objectContaining({
				corsProxy: 'https://cors.example.test/proxy',
			})
		);
	});

	it('can force the v2 execution path for legacy v1 declarations', async () => {
		const iframe = createIframe();
		const blueprint = {
			preferredVersions: {
				php: 'latest',
				wp: false,
			},
			steps: [],
		} as any;
		mocks.compileBlueprintForExecution.mockResolvedValue({
			version: 2,
			declaration: {
				version: 2,
				phpVersion: 'latest',
			},
			compiled: {},
			run: mocks.compiledRun,
		});
		const handler = new BlueprintsHandler({
			iframe,
			remoteUrl: 'http://example.com/remote.html',
			blueprint,
			experimentalBlueprintsV2Runner: true,
		});

		await handler.bootPlayground(iframe, createProgressTracker());

		expect(mocks.compileBlueprintForExecution).toHaveBeenCalledWith(
			blueprint,
			expect.objectContaining({
				executionPath: 'v2',
			})
		);
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
