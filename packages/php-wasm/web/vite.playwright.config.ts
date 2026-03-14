import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, mergeConfig } from 'vite';
import config from './vite.config';

export default defineConfig(() =>
	mergeConfig(
		config,
		defineConfig({
			assetsInclude: ['**/*.wasm', '**/*.so', '**/*.dat'],

			plugins: [
				// Vite 8's dev server doesn't handle `?url`
				// imports for `.so` and `.wasm` files correctly.
				// This plugin intercepts those imports and
				// returns a JS module that exports the file's
				// URL so the browser can fetch it.
				{
					name: 'asset-url-dev',
					enforce: 'pre' as const,
					apply: 'serve' as const,
					resolveId(source, importer) {
						if (/\.(so|wasm)\?url$/.test(source) && importer) {
							const importerDir = importer.startsWith('file://')
								? dirname(fileURLToPath(importer))
								: dirname(importer);
							const resolved = resolve(
								importerDir,
								source.replace('?url', '')
							);
							return `\0asset-url:${resolved}`;
						}
						return null;
					},
					load(id) {
						if (id.startsWith('\0asset-url:')) {
							const filePath = id.slice('\0asset-url:'.length);
							// Vite's dev server serves files
							// from disk via the /@fs/ prefix.
							const url = `/@fs${filePath}`;
							return `export default ${JSON.stringify(url)};`;
						}
						return null;
					},
				},
				{
					name: 'virtual-index-page',
					configureServer(server) {
						server.middlewares.use((req, res, next) => {
							if (req.url === '/') {
								res.end(
									`<!DOCTYPE html><html><head></head><body></body></html>`
								);
							} else {
								next();
							}
						});
					},
				},
				{
					name: 'virtual-wasm-feature-detect',
					resolveId(id) {
						if (id === 'virtual:wasm-feature-detect') return id;
						return null;
					},
					load(id) {
						if (id === 'virtual:wasm-feature-detect') {
							return `export async function jspi() {
									return ${process.env['JSPI'] === 'true'};
								}`;
						}
						return null;
					},
				},
			],

			server: {
				fs: {
					// Allow serving files from the entire monorepo root.
					// Needed because intl .so files live in web-builds/
					// which is a sibling of the web/ package.
					allow: ['../../..'],
				},
			},

			resolve: {
				alias: {
					'wasm-feature-detect': 'virtual:wasm-feature-detect',
				},
			},
		})
	)
);
