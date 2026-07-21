import { loadPHPRuntime } from '@php-wasm/universal/load-php-runtime';
import { PHP } from '@php-wasm/universal/php';
// Wrangler bundles the source package because workspace package artifacts are not prebuilt.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { decodeRemoteZip } from '../../../php-wasm/stream-compression/src';
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
const wordpressArchiveUrl = 'https://wordpress.org/latest.zip';
let isolateId: string | undefined;
let runtimePromise: Promise<PHP> | undefined;

export default {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		if (url.searchParams.get('probe') === 'remote-zip') {
			return remoteZipProbe();
		}

		const initializedForRequest = runtimePromise === undefined;
		const currentIsolateId = (isolateId ??= crypto.randomUUID());
		const php = await (runtimePromise ??= loadRuntime());
		const output = await php.run({
			code: `<?php echo json_encode(['php_version' => PHP_VERSION, 'marker' => '${HEALTH_MARKER}']);`,
		});
		const phpResult = JSON.parse(output.text) as Pick<
			HealthPayload,
			'php_version' | 'marker'
		>;
		const requestId = url.searchParams.get('run') ?? crypto.randomUUID();
		return healthResponse({
			...phpResult,
			initialization_scope: 'isolate',
			initialized_for_request: initializedForRequest,
			isolate_id: currentIsolateId,
			request_id: requestId,
			artifact: {
				php_version: phpVersion,
				async_mode: 'asyncify',
				loader: loaderPath,
				wasm_bytes: dependenciesTotalSize,
			},
		});
	},
};

async function remoteZipProbe(): Promise<Response> {
	const decoder = new TextDecoder();
	const expectedPath = 'wordpress/wp-includes/version.php';
	let predicateEntries = 0;
	let decodedEntries = 0;
	let includesVersion = false;
	const stream = await decodeRemoteZip(wordpressArchiveUrl, (entry) => {
		predicateEntries++;
		return isWordPressRuntimeAsset(decoder.decode(entry.path));
	});
	for await (const entry of stream) {
		decodedEntries++;
		const path =
			entry instanceof File ? entry.name : decoder.decode(entry.path);
		includesVersion ||= path === expectedPath;
	}
	if (!includesVersion || decodedEntries < 100) {
		throw new Error(
			`Expected ${expectedPath} and at least 100 entries, received ${decodedEntries}.`
		);
	}

	return Response.json({
		marker: 'cloudflare-remote-zip-range-gate',
		archive: wordpressArchiveUrl,
		predicateEntries,
		decodedEntries,
		includesVersion,
	});
}

function isWordPressRuntimeAsset(path: string): boolean {
	return /\.(?:php|json|html?|css|m?js|svg|png|jpe?g|gif|webp|avif|woff2?|ttf|otf)$/i.test(
		path
	);
}

async function loadRuntime(): Promise<PHP> {
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
	return new PHP(runtimeId);
}
