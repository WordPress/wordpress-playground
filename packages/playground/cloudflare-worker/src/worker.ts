import { loadPHPRuntime } from '@php-wasm/universal/load-php-runtime';
import { PHP } from '@php-wasm/universal/php';
import {
	dependenciesTotalSize,
	init,
} from '@php-wasm/web-8-5/asyncify/php_8_5';
// Wrangler must see this relative Wasm module import to compile it for workerd.
// eslint-disable-next-line @nx/enforce-module-boundaries
import phpWasmModule from '../../../php-wasm/web-builds/8-5/asyncify/8_5_8/php_8_5.wasm';
import {
	HEALTH_MARKER,
	healthResponse,
	instantiatePrecompiledWasm,
	type HealthPayload,
} from '@wp-playground/cloudflare-worker-memory-gate/runtime';

const loaderPath = '@php-wasm/web-8-5/asyncify/php_8_5.js';
const phpVersion = '8.5.8' as const;
let runtimePromise: Promise<{ php: PHP; initializationMs: number }> | undefined;

export default {
	async fetch(): Promise<Response> {
		const initializedForRequest = runtimePromise === undefined;
		const { php, initializationMs } = await (runtimePromise ??=
			loadRuntime());
		const executionStarted = performance.now();
		const output = await php.run({
			code: `<?php echo json_encode(['php_version' => PHP_VERSION, 'marker' => '${HEALTH_MARKER}']);`,
		});
		const phpResult = JSON.parse(output.text) as Pick<
			HealthPayload,
			'php_version' | 'marker'
		>;
		return healthResponse({
			...phpResult,
			timing_ms: {
				initialization: initializationMs,
				execution: performance.now() - executionStarted,
			},
			initialization_scope: 'isolate',
			initialized_for_request: initializedForRequest,
			artifact: {
				php_version: phpVersion,
				async_mode: 'asyncify',
				loader: loaderPath,
				wasm_bytes: dependenciesTotalSize,
			},
		});
	},
};

async function loadRuntime(): Promise<{ php: PHP; initializationMs: number }> {
	const initializationStarted = performance.now();
	const runtimeId = await loadPHPRuntime(
		{
			dependencyFilename: 'php_8_5.wasm',
			dependenciesTotalSize,
			phpWasmAsyncMode: 'asyncify',
			init,
		},
		{
			// Wrangler supplies this import as a precompiled workerd Wasm module.
			instantiateWasm: instantiatePrecompiledWasm(phpWasmModule),
		}
	);
	return {
		php: new PHP(runtimeId),
		initializationMs: performance.now() - initializationStarted,
	};
}
