import { describe, expect, it } from 'vitest';
import {
	healthResponse,
	instantiatePrecompiledWasm,
	type HealthPayload,
} from './runtime';

describe('instantiatePrecompiledWasm', () => {
	it("passes the precompiled module to Emscripten's instance callback", () => {
		const module = new WebAssembly.Module(
			new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])
		);
		let receivedModule: WebAssembly.Module | undefined;
		let receivedInstance: WebAssembly.Instance | undefined;
		instantiatePrecompiledWasm(module)({}, (instance, wasmModule) => {
			receivedInstance = instance;
			receivedModule = wasmModule;
		});
		expect(receivedModule).toBe(module);
		expect(receivedInstance).toBeInstanceOf(WebAssembly.Instance);
	});
});

describe('healthResponse', () => {
	it('returns JSON without coupling the response contract to a Worker runtime', async () => {
		const payload: HealthPayload = {
			php_version: '8.5.8',
			marker: 'cloudflare-php-wasm-memory-gate',
			timing_ms: { initialization: 1, execution: 2 },
			initialization_scope: 'isolate',
			initialized_for_request: true,
			artifact: {
				php_version: '8.5.8',
				async_mode: 'asyncify',
				loader: '@php-wasm/web-8-5/asyncify/php_8_5.js',
				wasm_bytes: 21019221,
			},
		};
		const response = healthResponse(payload);
		expect(response.headers.get('content-type')).toBe(
			'application/json; charset=utf-8'
		);
		expect(await response.json()).toEqual(payload);
	});
});
