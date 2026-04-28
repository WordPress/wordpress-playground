import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { loadNodeRuntime } from '@php-wasm/node';
import { PHP, loadExtension } from '@php-wasm/universal';

const [manifestPath, phpVersion, asyncMode, code, expectedOutput] =
	process.argv.slice(2);

if (!manifestPath || !phpVersion || !asyncMode || !code) {
	throw new Error(
		'Usage: load-built-extension.mjs <manifest> <php-version> <async-mode> <php-code> <expected-output>'
	);
}

const manifestDirectory = path.dirname(path.resolve(manifestPath));
const manifestUrl = new URL('https://php-wasm.invalid/manifest.json');

const php = new PHP(
	await loadNodeRuntime(phpVersion, {
		emscriptenOptions: { processId: 1 },
	})
);
try {
	await loadExtension(php, {
		manifestUrl,
		phpVersion,
		asyncMode,
		fetch: createFileFetch(manifestDirectory),
	});

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

function createFileFetch(directory) {
	return async function fileFetch(url) {
		const requestUrl = new URL(String(url));
		const file =
			requestUrl.pathname === '/manifest.json'
				? path.resolve(directory, 'manifest.json')
				: path.resolve(directory, path.basename(requestUrl.pathname));
		if (path.relative(directory, file).startsWith('..')) {
			return new Response('Not found', { status: 404 });
		}
		const bytes = await readFile(file);
		return new Response(bytes, {
			status: 200,
			headers: {
				'content-type': file.endsWith('.json')
					? 'application/json'
					: 'application/wasm',
				'x-file-url': pathToFileURL(file).href,
			},
		});
	};
}
