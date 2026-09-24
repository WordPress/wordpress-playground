import { build } from 'vite';
import { glob, readFile, writeFile } from 'node:fs/promises';
import { brotliCompressSync, constants } from 'node:zlib';

// A new prefix prevents immutable cached files from surviving a local rebuild.
const release = Date.now().toString(36);
const base = `http://static.playground.localhost:9400/${release}/`;
const shellAssets = new Set(['/', '/remote.html', '/manifest.json']);
for (const name of ['client', 'remote', 'website']) {
	await build({
		configFile: `packages/playground/${name}/vite.config.ts`,
		mode: 'production',
		base,
		build: {
			outDir: `../../../dist/packages/playground/${name}`,
			manifest: name !== 'client',
			// Let Rollup split this build by actual imports. The normal manual
			// chunks pull the lazy editor into the app's startup dependency graph.
			...(name === 'website'
				? {
						rollupOptions: {
							output: { manualChunks: () => undefined },
						},
					}
				: {}),
		},
	});
	if (name === 'website') {
		// Build the bridge separately. App manual chunks otherwise pull OPFS and
		// editor initialization into this document, which must never boot a site.
		await build({
			configFile: false,
			resolve: {
				alias: {
					'@php-wasm/util': new URL(
						'../../../../php-wasm/util/src/index.ts',
						import.meta.url
					).pathname,
				},
			},
			build: {
				outDir: 'dist/packages/playground/website',
				emptyOutDir: false,
				target: 'esnext',
				lib: {
					entry: new URL(
						'../../src/lib/origin-isolation-bridge.ts',
						import.meta.url
					).pathname,
					formats: ['es'],
					fileName: () => 'origin-isolation.js',
				},
			},
		});
	}

	if (name !== 'client') {
		const manifest = JSON.parse(
			await readFile(
				`dist/packages/playground/${name}/.vite/manifest.json`,
				'utf8'
			)
		);
		const visited = new Set();
		function includeShellModule(key) {
			if (visited.has(key)) return;
			visited.add(key);
			const chunk = manifest[key];
			if (!chunk) throw new Error(`Missing shell entry ${key}`);
			shellAssets.add(new URL(chunk.file, base).href);
			for (const css of chunk.css || [])
				shellAssets.add(new URL(css, base).href);
			for (const dependency of chunk.imports || [])
				includeShellModule(dependency);
		}
		// index.html imports main dynamically for its load-error fallback. All
		// other dynamic imports (editors, PHP versions, etc.) stay demand-loaded.
		const entry = name === 'website' ? 'index.html' : 'remote.html';
		includeShellModule(entry);
		if (name === 'website') {
			for (const main of manifest[entry].dynamicImports || [])
				includeShellModule(main);
		}
	}
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
	'dist/origin-isolation-shell.json',
	JSON.stringify([...shellAssets])
);
await writeFile(
	'dist/origin-isolation.json',
	JSON.stringify({ release, base })
);
