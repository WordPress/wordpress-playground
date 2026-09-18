import { loadNodeRuntime } from '@php-wasm/node';
import {
	loadPHPRuntime,
	PHP,
	resolvePHPExtension,
	withResolvedPHPExtensions,
} from '@php-wasm/universal';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const [
	manifestPath,
	phpVersion,
	code,
	expectedOutput,
	runtimeLoaderPath,
	iniDirective,
] = process.argv.slice(2);

if (!manifestPath || !phpVersion || !code) {
	throw new Error(
		'Usage: load-built-extension.mjs <manifest> <php-version> <php-code> <expected-output> [runtime-loader] [ini-directive]'
	);
}

const php = runtimeLoaderPath
	? await loadFreshRuntime(
			manifestPath,
			phpVersion,
			runtimeLoaderPath,
			iniDirective
		)
	: new PHP(
			await loadNodeRuntime(phpVersion, {
				emscriptenOptions: { processId: 1 },
				extensions: [
					{
						source: {
							format: 'manifest',
							manifestUrl: manifestPath,
						},
					},
				],
			})
		);
try {
	const result = await php.run({ code });
	if (result.errors) {
		throw new Error(result.errors);
	}
	if (result.text !== expectedOutput) {
		throw new Error(
			`Expected ${JSON.stringify(expectedOutput)}, got ${JSON.stringify(
				result.text
			)}`
		);
	}
} finally {
	php.exit();
}

async function loadFreshRuntime(
	manifestPath,
	phpVersion,
	runtimeLoaderPath,
	iniDirective
) {
	const runtimeModule = await import(pathToFileURL(runtimeLoaderPath).href);
	const extension = await resolvePHPExtension({
		source: {
			format: 'manifest',
			manifestUrl: pathToFileURL(manifestPath).href,
		},
		phpVersion,
		// Generated manifests do not record a directive yet, so let callers
		// force `zend_extension=` for a pure Zend extension.
		...(iniDirective ? { loadWithIniDirective: iniDirective } : {}),
		fetch: async (url) => {
			const response =
				new URL(url).protocol === 'file:'
					? new Response(await readFile(new URL(url)))
					: await fetch(url);
			if (!response.ok) {
				throw new Error(`Could not load extension artifact: ${url}`);
			}
			return response;
		},
	});
	const runtimeId = await loadPHPRuntime(
		runtimeModule,
		withResolvedPHPExtensions({ phpWasmAsyncMode: 'jspi' }, [extension])
	);
	return new PHP(runtimeId);
}
