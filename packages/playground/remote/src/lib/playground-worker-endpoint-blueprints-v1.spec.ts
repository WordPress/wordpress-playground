import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PHP } from '@php-wasm/universal';

describe('PlaygroundWorkerEndpointBlueprintsV1', () => {
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
		await import('./playground-worker-endpoint-blueprints-v1');
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
			shouldInstallWordPress: false,
			withNetworking: false,
		});

		expect(bootWordPress).toHaveBeenCalledTimes(1);
		expect(bootWordPress.mock.calls[0][1].wordPressZip).toBeUndefined();
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
		await import('./playground-worker-endpoint-blueprints-v1');
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
			shouldBootWordPress: false,
			withNetworking: false,
		});

		expect(bootWordPress).not.toHaveBeenCalled();
		expect(mountOpfsIntoPhp).toHaveBeenCalledWith(php, mount);
		expect(fetch).not.toHaveBeenCalled();
	}, 10000);

	it('rejects WordPress installation when boot is disabled', async () => {
		let endpoint:
			| {
					boot(options: Record<string, unknown>): Promise<void>;
			  }
			| undefined;
		vi.doMock('@wp-playground/wordpress', () => ({
			bootWordPress: vi.fn(),
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
		await import('./playground-worker-endpoint-blueprints-v1');
		if (!endpoint) {
			throw new Error('Expected exposeAPI to receive an endpoint');
		}

		await expect(
			endpoint.boot({
				scope: 'test',
				phpVersion: '8.3',
				shouldBootWordPress: false,
				shouldInstallWordPress: true,
				withNetworking: false,
			})
		).rejects.toThrow(
			'Conflicting options: WordPress installation was requested, ' +
				'but WordPress boot was disabled. Pick one.'
		);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('throws a diagnostic error if the worker entrypoint is evaluated twice in the same worker global', async () => {
		vi.doMock('@php-wasm/web', () => ({
			certificateToPEM: vi.fn(),
			createDirectoryHandleMountHandler: vi.fn(),
			exposeAPI: vi.fn(() => [vi.fn(), vi.fn()]),
			loadWebRuntime: vi.fn(),
		}));

		await import('./playground-worker-endpoint-blueprints-v1');

		vi.resetModules();
		await expect(
			import('./playground-worker-endpoint-blueprints-v1')
		).rejects.toThrow(
			'The Blueprints v1 Playground worker tried to expose its Comlink endpoint more than once in the same worker global.'
		);
	});
});
