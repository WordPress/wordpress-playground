export const HEALTH_MARKER = 'cloudflare-php-wasm-memory-gate';

export type HealthPayload = {
	php_version: string;
	marker: string;
	timing_ms: { initialization: number; execution: number };
	initialization_scope: 'isolate';
	initialized_for_request: boolean;
	artifact: {
		php_version: '8.5.8';
		async_mode: 'asyncify';
		loader: string;
		wasm_bytes: number;
	};
};

export function instantiatePrecompiledWasm(module: WebAssembly.Module) {
	return (
		imports: WebAssembly.Imports,
		receiveInstance: (
			instance: WebAssembly.Instance,
			module: WebAssembly.Module
		) => void
	) => {
		receiveInstance(new WebAssembly.Instance(module, imports), module);
	};
}

export function healthResponse(payload: HealthPayload): Response {
	return new Response(JSON.stringify(payload), {
		headers: { 'content-type': 'application/json; charset=utf-8' },
	});
}
