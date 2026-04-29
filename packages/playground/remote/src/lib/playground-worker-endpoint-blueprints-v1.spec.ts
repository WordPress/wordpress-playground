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

	it('registers OPFS mounts created during the Blueprints v1 boot path', async () => {
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
			withIntl: false,
			withNetworking: false,
		});

		expect(mountOpfsIntoPhp).toHaveBeenCalledWith(php, mount);
	}, 10000);
});
