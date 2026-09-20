import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PHP } from '@php-wasm/universal';

describe('PlaygroundWorkerEndpointBlueprints', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubGlobal('self', {
			postMessage: vi.fn(),
		});
		vi.stubGlobal('caches', {
			open: vi.fn(async () => ({})),
		});
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(new ArrayBuffer(0)))
		);
	});

	afterEach(() => {
		vi.doUnmock('@php-wasm/web');
		vi.doUnmock('@wp-playground/blueprints');
		vi.doUnmock('@wp-playground/wordpress');
		vi.unstubAllGlobals();
	});

	it('runs WordPress boot setup for mounted installed WordPress sites', async () => {
		const php = {} as PHP;
		const bootWordPress = vi.fn(async (_requestHandler, options) => {
			await options.hooks.beforeWordPressFiles(php);
		});
		const requestHandler = {
			getPrimaryPhp: vi.fn(async () => php),
		};
		let endpoint:
			| {
					boot(options: Record<string, unknown>): Promise<void>;
			  }
			| undefined;
		vi.doMock('@wp-playground/wordpress', () => ({
			bootWordPress,
		}));
		vi.doMock('@php-wasm/web', () => ({
			certificateToPEM: vi.fn(),
			createDirectoryHandleMountHandler: vi.fn(),
			exposeAPI: vi.fn((api) => {
				endpoint = api;
				return [vi.fn(), vi.fn()];
			}),
			loadWebRuntime: vi.fn(),
		}));
		await import('./playground-worker-endpoint-blueprints');
		if (!endpoint) {
			throw new Error('Expected exposeAPI to receive an endpoint');
		}
		vi.spyOn(endpoint as any, 'computeSiteUrl').mockReturnValue(
			'http://playground.test'
		);
		vi.spyOn(endpoint as any, 'createRequestHandler').mockResolvedValue(
			requestHandler
		);
		vi.spyOn(endpoint as any, 'finalizeAfterBoot').mockResolvedValue(
			undefined
		);
		const mountOpfsIntoPhp = vi
			.spyOn(endpoint as any, 'mountOpfsIntoPhp')
			.mockResolvedValue(undefined);
		const mount = {
			device: { type: 'local-fs', handle: {} },
			initialSyncDirection: 'opfs-to-memfs',
			mountpoint: '/wordpress',
		};

		await endpoint.boot({
			scope: 'test',
			mounts: [mount as any],
			phpVersion: '8.3',
			wordpressInstallMode: 'install-from-existing-files-if-needed',
			withNetworking: false,
		});

		expect(bootWordPress).toHaveBeenCalledTimes(1);
		expect(bootWordPress.mock.calls[0][1].wordPressZip).toBeUndefined();
		expect(bootWordPress.mock.calls[0][1].wordpressInstallMode).toBe(
			'install-from-existing-files-if-needed'
		);
		expect(mountOpfsIntoPhp).toHaveBeenCalledWith(php, mount);
	}, 10000);

	it('mounts PHP-only playgrounds without running WordPress boot setup', async () => {
		const php = {} as PHP;
		const bootWordPress = vi.fn();
		const requestHandler = {
			getPrimaryPhp: vi.fn(async () => php),
		};
		let endpoint:
			| {
					boot(options: Record<string, unknown>): Promise<void>;
			  }
			| undefined;
		vi.doMock('@wp-playground/wordpress', () => ({
			bootWordPress,
		}));
		vi.doMock('@php-wasm/web', () => ({
			certificateToPEM: vi.fn(),
			createDirectoryHandleMountHandler: vi.fn(),
			exposeAPI: vi.fn((api) => {
				endpoint = api;
				return [vi.fn(), vi.fn()];
			}),
			loadWebRuntime: vi.fn(),
		}));
		await import('./playground-worker-endpoint-blueprints');
		if (!endpoint) {
			throw new Error('Expected exposeAPI to receive an endpoint');
		}
		vi.spyOn(endpoint as any, 'computeSiteUrl').mockReturnValue(
			'http://playground.test'
		);
		vi.spyOn(endpoint as any, 'createRequestHandler').mockResolvedValue(
			requestHandler
		);
		const mountOpfsIntoPhp = vi
			.spyOn(endpoint as any, 'mountOpfsIntoPhp')
			.mockResolvedValue(undefined);
		const mount = {
			device: { type: 'local-fs', handle: {} },
			initialSyncDirection: 'opfs-to-memfs',
			mountpoint: '/wordpress',
		};

		await endpoint.boot({
			scope: 'test',
			mounts: [mount as any],
			phpVersion: '8.3',
			wordpressInstallMode: 'do-not-attempt-installing',
			withNetworking: false,
		});

		expect(bootWordPress).not.toHaveBeenCalled();
		expect(mountOpfsIntoPhp).toHaveBeenCalledWith(php, mount);
		expect(fetch).not.toHaveBeenCalled();
	}, 10000);

	it('rejects incompatible mounted WordPress before boot setup continues', async () => {
		const php = {
			fileExists: vi.fn(() => true),
			run: vi.fn(async () => ({ text: ' 6.7.5\n' })),
		} as unknown as PHP;
		const bootContinued = vi.fn();
		const assertCompatibility = vi.fn(async () => {
			throw new Error('Incompatible WordPress version');
		});
		const bootWordPress = vi.fn(async (_requestHandler, options) => {
			await options.hooks.beforeWordPressFiles(php);
			bootContinued();
		});
		let endpoint:
			| {
					boot(options: Record<string, unknown>): Promise<void>;
			  }
			| undefined;
		vi.doMock('@wp-playground/blueprints', () => ({
			assertBlueprintV2WordPressVersionCompatibility: assertCompatibility,
		}));
		vi.doMock('@wp-playground/wordpress', () => ({
			bootWordPress,
		}));
		vi.doMock('@php-wasm/web', () => ({
			certificateToPEM: vi.fn(),
			createDirectoryHandleMountHandler: vi.fn(),
			exposeAPI: vi.fn((api) => {
				endpoint = api;
				return [vi.fn(), vi.fn()];
			}),
			loadWebRuntime: vi.fn(),
		}));
		await import('./playground-worker-endpoint-blueprints');
		if (!endpoint) {
			throw new Error('Expected exposeAPI to receive an endpoint');
		}
		vi.spyOn(endpoint as any, 'computeSiteUrl').mockReturnValue(
			'http://playground.test'
		);
		vi.spyOn(endpoint as any, 'createRequestHandler').mockResolvedValue({});

		await expect(
			endpoint.boot({
				scope: 'test',
				phpVersion: '8.3',
				wordpressInstallMode: 'install-from-existing-files',
				blueprint: {
					version: 2,
					wordpressVersion: { min: '6.8' },
				},
				withNetworking: false,
			})
		).rejects.toThrow('Incompatible WordPress version');

		expect(assertCompatibility).toHaveBeenCalledWith(
			expect.objectContaining({ version: 2 }),
			'6.7.5'
		);
		expect(bootContinued).not.toHaveBeenCalled();
	}, 10000);

	it.each([
		{
			wpVersion: '6.8.0',
			releaseUrl: 'https://wordpress.org/wordpress-6.8.zip',
			status: 200,
		},
		{
			wpVersion: '7.0-rc1',
			releaseUrl: 'https://wordpress.org/wordpress-7.0-RC1.zip',
			status: 200,
		},
		{
			wpVersion: '6.8.0',
			releaseUrl: 'https://wordpress.org/wordpress-6.8.zip',
			status: 404,
			expectedName: 'ResourceUnavailableError',
			expectedMessage: 'WordPress 6.8 is not available for download.',
		},
		{
			wpVersion: '6.8.0',
			releaseUrl: 'https://wordpress.org/wordpress-6.8.zip',
			status: 500,
			expectedName: 'Error',
			expectedMessage: 'Failed to download WordPress 6.8 (HTTP 500)',
		},
	])(
		'handles a concrete WordPress release $wpVersion with HTTP $status',
		async ({
			wpVersion,
			releaseUrl,
			status,
			expectedName,
			expectedMessage,
		}) => {
			vi.stubGlobal(
				'fetch',
				vi.fn(async (url) =>
					String(url).includes('wordpress-')
						? new Response(null, { status })
						: new Response(new ArrayBuffer(0))
				)
			);
			const bootWordPress = vi.fn(async (_requestHandler, options) => {
				await options.wordPressZip;
			});
			let endpoint:
				| {
						boot(options: Record<string, unknown>): Promise<void>;
				  }
				| undefined;
			vi.doMock('@wp-playground/wordpress', () => ({
				bootWordPress,
			}));
			vi.doMock('@php-wasm/web', () => ({
				certificateToPEM: vi.fn(),
				createDirectoryHandleMountHandler: vi.fn(),
				exposeAPI: vi.fn((api) => {
					endpoint = api;
					return [vi.fn(), vi.fn()];
				}),
				loadWebRuntime: vi.fn(),
			}));
			await import('./playground-worker-endpoint-blueprints');
			if (!endpoint) {
				throw new Error('Expected exposeAPI to receive an endpoint');
			}
			vi.spyOn(endpoint as any, 'computeSiteUrl').mockReturnValue(
				'http://playground.test'
			);
			vi.spyOn(endpoint as any, 'createRequestHandler').mockResolvedValue(
				{}
			);
			vi.spyOn(endpoint as any, 'finalizeAfterBoot').mockResolvedValue(
				undefined
			);

			const boot = endpoint.boot({
				scope: 'test',
				phpVersion: '8.3',
				wpVersion,
				wordpressInstallMode: 'download-and-install',
				corsProxyUrl: 'https://proxy.test/?url=',
				withNetworking: false,
			});
			if (expectedMessage) {
				await expect(boot).rejects.toMatchObject({
					name: expectedName,
					message: expectedMessage,
				});
			} else {
				await boot;
			}

			expect(fetch).toHaveBeenCalledWith(
				`https://proxy.test/?url=${releaseUrl}`
			);
		},
		10000
	);

	it('uses a caller-provided WordPress archive without downloading core', async () => {
		const bootWordPress = vi.fn();
		let endpoint:
			| {
					boot(options: Record<string, unknown>): Promise<void>;
			  }
			| undefined;
		vi.doMock('@wp-playground/wordpress', () => ({
			bootWordPress,
		}));
		vi.doMock('@php-wasm/web', () => ({
			certificateToPEM: vi.fn(),
			createDirectoryHandleMountHandler: vi.fn(),
			exposeAPI: vi.fn((api) => {
				endpoint = api;
				return [vi.fn(), vi.fn()];
			}),
			loadWebRuntime: vi.fn(),
		}));
		await import('./playground-worker-endpoint-blueprints');
		if (!endpoint) {
			throw new Error('Expected exposeAPI to receive an endpoint');
		}
		vi.spyOn(endpoint as any, 'computeSiteUrl').mockReturnValue(
			'http://playground.test'
		);
		vi.spyOn(endpoint as any, 'createRequestHandler').mockResolvedValue({});
		vi.spyOn(endpoint as any, 'finalizeAfterBoot').mockResolvedValue(
			undefined
		);
		const wordPressZip = new File(['custom WordPress'], 'wordpress.zip');

		await endpoint.boot({
			scope: 'test',
			phpVersion: '8.3',
			wpVersion: 'custom',
			wordPressZip,
			wordpressInstallMode: 'download-and-install',
			withNetworking: false,
		});

		expect(bootWordPress).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ wordPressZip })
		);
		// SQLite still downloads in parallel; WordPress core does not.
		expect(fetch).toHaveBeenCalledTimes(1);
	}, 10000);

	it('throws a diagnostic error if the worker entrypoint is evaluated twice in the same worker global', async () => {
		vi.doMock('@php-wasm/web', () => ({
			certificateToPEM: vi.fn(),
			createDirectoryHandleMountHandler: vi.fn(),
			exposeAPI: vi.fn(() => [vi.fn(), vi.fn()]),
			loadWebRuntime: vi.fn(),
		}));

		await import('./playground-worker-endpoint-blueprints');

		vi.resetModules();
		await expect(
			import('./playground-worker-endpoint-blueprints')
		).rejects.toThrow(
			'The Blueprints Playground worker tried to expose its Comlink endpoint more than once in the same worker global.'
		);
	});
});
