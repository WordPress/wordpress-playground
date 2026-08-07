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
		compileBlueprintForExecution: vi.fn(),
		resolveBlueprintV2WordPressSource: vi.fn(),
		resolveRuntimeConfiguration: vi.fn(),
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
	compileBlueprintForExecution: mocks.compileBlueprintForExecution,
	isBlueprintBundle: (blueprint: unknown) =>
		!!blueprint &&
		typeof (blueprint as { read?: unknown }).read === 'function',
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
		mocks.compiledRun.mockResolvedValue(undefined);
		mocks.resolveBlueprintV2WordPressSource.mockResolvedValue(undefined);
		mocks.compileBlueprintForExecution.mockImplementation(
			async (blueprint) => ({
				version: 2,
				declaration: blueprint,
				compiled: {
					runtime: {
						phpVersion: '8.4',
						wpVersion: 'latest',
						intl: false,
						networking: true,
					},
				},
				run: mocks.compiledRun,
			})
		);
		mocks.resolveRuntimeConfiguration.mockResolvedValue({
			phpVersion: '8.4',
			wpVersion: 'latest',
			intl: false,
			networking: true,
		});
		mocks.consumeAPI.mockReturnValue(mocks.playground);
	});

	it('boots and runs Blueprint v2 declarations through the native compiler', async () => {
		mocks.compileBlueprintForExecution.mockResolvedValue({
			version: 2,
			declaration: {
				version: 2,
			},
			compiled: {
				runtime: {
					phpVersion: '8.2',
					wpVersion: '6.4',
					intl: true,
					networking: false,
				},
			},
			run: mocks.compiledRun,
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

		expect(mocks.resolveRuntimeConfiguration).not.toHaveBeenCalled();
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
				onBlueprintValidated,
				onStepCompleted: onBlueprintStepCompleted,
				corsProxy: 'https://cors.example.test/proxy',
			})
		);
		expect(mocks.compiledRun).toHaveBeenCalledWith(mocks.playground);
		expect(onClientConnected).toHaveBeenCalledWith(mocks.playground);
	});

	it('boots PHP-only Blueprints without installing WordPress', async () => {
		const iframe = createIframe();
		const blueprint = {
			version: 2,
			wordpressVersion: 'none',
		} as const;
		const handler = new BlueprintsV2Handler({
			iframe,
			remoteUrl: 'http://example.com/remote.html',
			blueprint,
		});

		await handler.bootPlayground(iframe, createProgressTracker());

		expect(mocks.playground.boot).toHaveBeenCalledWith(
			expect.objectContaining({
				wordpressInstallMode: 'do-not-attempt-installing',
				wordPressZip: undefined,
			})
		);
		expect(mocks.resolveBlueprintV2WordPressSource).not.toHaveBeenCalled();
	});

	it('does not preflight existing WordPress files for PHP-only Blueprints', async () => {
		const iframe = createIframe();
		const blueprint = {
			version: 2,
			wordpressVersion: 'none',
		} as const;
		const handler = new BlueprintsV2Handler({
			iframe,
			remoteUrl: 'http://example.com/remote.html',
			blueprint,
			wordpressInstallMode: 'install-from-existing-files-if-needed',
		});

		await handler.bootPlayground(iframe, createProgressTracker());

		expect(mocks.playground.boot).toHaveBeenCalledWith(
			expect.objectContaining({
				wordpressInstallMode: 'do-not-attempt-installing',
				blueprint: undefined,
			})
		);
	});

	it('does not pipe remote progress when progress UI is disabled', async () => {
		const iframe = createIframe();
		const blueprint = {
			version: 2,
			siteOptions: {
				blogname: 'V2 site',
			},
		};
		const progressTracker = createProgressTracker();
		const handler = new BlueprintsV2Handler({
			iframe,
			remoteUrl: 'http://example.com/remote.html',
			blueprint,
			disableProgressBar: true,
		});

		await handler.bootPlayground(iframe, progressTracker);

		expect(progressTracker.pipe).not.toHaveBeenCalled();
	});

	it('passes resolved v2 WordPress archives to the worker', async () => {
		const iframe = createIframe();
		const blueprint = {
			version: 2,
			wordpressVersion: './wordpress.zip',
		} as const;
		const wordPressZip = new File(['wordpress'], 'wordpress.zip');
		mocks.resolveBlueprintV2WordPressSource.mockResolvedValue(wordPressZip);
		const handler = new BlueprintsV2Handler({
			iframe,
			remoteUrl: 'http://example.com/remote.html',
			blueprint,
		});

		await handler.bootPlayground(iframe, createProgressTracker());

		expect(mocks.resolveBlueprintV2WordPressSource).toHaveBeenCalledWith(
			blueprint,
			expect.objectContaining({ streamBundledFile: undefined })
		);
		expect(mocks.playground.boot).toHaveBeenCalledWith(
			expect.objectContaining({ wordPressZip })
		);
	});

	it('passes mounted-site constraints to the worker preflight', async () => {
		const iframe = createIframe();
		const blueprint = {
			version: 2,
			wordpressVersion: {
				min: '6.8',
			},
			siteOptions: {
				blogname: 'Existing site',
			},
		} as const;
		const handler = new BlueprintsV2Handler({
			iframe,
			remoteUrl: 'http://example.com/remote.html',
			blueprint,
			wordpressInstallMode: 'install-from-existing-files-if-needed',
		});

		await handler.bootPlayground(iframe, createProgressTracker());

		expect(mocks.playground.boot).toHaveBeenCalledWith(
			expect.objectContaining({
				blueprint: {
					version: 2,
					wordpressVersion: blueprint.wordpressVersion,
				},
			})
		);
		expect(mocks.compileBlueprintForExecution).toHaveBeenCalledWith(
			blueprint,
			expect.objectContaining({
				siteMode: 'apply-to-existing-site',
			})
		);
	});

	it('does not validate WordPress downloaded for a new site', async () => {
		const iframe = createIframe();
		const handler = new BlueprintsV2Handler({
			iframe,
			remoteUrl: 'http://example.com/remote.html',
			blueprint: { version: 2 },
			wordpressInstallMode: 'download-and-install',
		});

		await handler.bootPlayground(iframe, createProgressTracker());

		expect(mocks.playground.boot).toHaveBeenCalledWith(
			expect.objectContaining({ blueprint: undefined })
		);
		expect(mocks.compileBlueprintForExecution).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ siteMode: 'create-new-site' })
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
