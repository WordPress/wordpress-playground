import { build } from 'vite';
import { glob, readFile, writeFile } from 'node:fs/promises';
import { brotliCompressSync, constants } from 'node:zlib';

// A new prefix prevents immutable cached files from surviving a local rebuild.
const release = Date.now().toString(36);
const base = `http://static.playground.localhost:9400/${release}/`;
for (const name of ['remote', 'website']) {
	await build({
		configFile: `packages/playground/${name}/vite.config.ts`,
		mode: 'production',
		base,
		build: { outDir: `../../../dist/packages/playground/${name}` },
	});
	// Compress the runtime and app bundles, not already-compressed ZIP/Zstandard
	// archives. Small wire representations also fit private browsing's HTTP cache.
	const output = `dist/packages/playground/${name}`;
	for await (const file of glob([
		`${output}/*.{js,css}`,
		`${output}/assets/**/*.{js,css,wasm}`,
	])) {
		await writeFile(
			`${file}.br`,
			brotliCompressSync(await readFile(file), {
				params: { [constants.BROTLI_PARAM_QUALITY]: 6 },
			})
		);
	}
}
await writeFile(
	'dist/origin-isolation.json',
	JSON.stringify({ release, base })
);
