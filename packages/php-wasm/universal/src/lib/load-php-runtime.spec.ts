import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const RuntimeRegistryKey = Symbol.for('@php-wasm/universal@3.loadedRuntimes');

function deleteRuntimeRegistry() {
	delete (globalThis as Record<symbol, unknown>)[RuntimeRegistryKey];
}

function createLoaderModule() {
	return {
		phpWasmAsyncMode: 'jspi',
		init: vi.fn((_runtime, options) => {
			const phpRuntime = {
				FS: {},
				_exit: vi.fn(),
				outboundNetworkProxyServer: undefined,
			};
			queueMicrotask(() => options.onRuntimeInitialized());
			return phpRuntime;
		}),
	} as any;
}

describe('PHP runtime registry', () => {
	beforeEach(() => {
		deleteRuntimeRegistry();
	});

	afterEach(() => {
		deleteRuntimeRegistry();
	});

	it('shares loaded runtimes across duplicate module instances', async () => {
		vi.resetModules();
		const firstModule = await import('./load-php-runtime');
		const runtimeId =
			await firstModule.loadPHPRuntime(createLoaderModule());

		vi.resetModules();
		const secondModule = await import('./load-php-runtime');
		const runtime = secondModule.popLoadedRuntime(runtimeId as any);

		expect(runtime.id).toBe(runtimeId);
		expect(() => firstModule.popLoadedRuntime(runtimeId as any)).toThrow(
			`Runtime with id ${runtimeId} not found`
		);
	});
});
