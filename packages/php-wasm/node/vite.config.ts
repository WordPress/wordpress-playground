/**
 * For Vitest only! The module is built with esbuild which is configured
 * in project.json.
 */
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import viteTsConfigPaths from 'vite-tsconfig-paths';
import path from 'path';
import type { Plugin } from 'vite';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { getExternalModules } from '../../vite-extensions/vite-external-modules';
// eslint-disable-next-line @nx/enforce-module-boundaries
import viteGlobalExtensions from '../../vite-extensions/vite-global-extensions';

export default defineConfig(function () {
	return {
		root: __dirname,
		cacheDir: '../../../node_modules/.vite/php-wasm',

		plugins: [
			viteTsConfigPaths({
				root: '../../../',
			}),
			{
				name: 'import-url',
				enforce: 'pre',

				resolveId(id: string, importer: string): any {
					if (id.startsWith('import-url:')) {
						return id;
					}

					if (!path.isAbsolute(id) && id.endsWith('?url')) {
						const filepath = path.resolve(
							path.dirname(importer),
							id
						);
						return `import-url:${filepath}`;
					}

					return null;
				},

				load(id: string): any {
					if (id.startsWith('import-url:')) {
						const encodedPath = id.slice('import-url:'.length);
						const filePath = encodedPath.replace('?url', '');

						return {
							code: `export default ${JSON.stringify(filePath)};`,
							map: null,
						};
					}

					return null;
				},
			} as Plugin,

			...viteGlobalExtensions,
		],

		// Configuration for building your library.
		// See: https://vitejs.dev/guide/build.html#library-mode
		build: {
			target: 'node',
			lib: {
				// Could also be a dictionary or array of multiple entry points.
				entry: 'src/index.ts',
				name: 'php-wasm-node',
				fileName: 'index',
				formats: ['es'],
			},
			sourcemap: true,
			rollupOptions: {
				external: getExternalModules(),
				output: {
					entryFileNames: '[name].js',
					chunkFileNames: '[name].js',
				},
			},
		},

		test: {
			globals: true,
			cache: {
				dir: '../../../node_modules/.vitest',
			},
			env: {
				TEST: JSON.stringify(true),
			},
			poolOptions: {
				// This is needed to allow `--expose-gc` to be passed to the
				// forked test process.
				forks: {
					// execArgv: ['--expose-gc', '--max-old-space-size=9216'],
					execArgv: ['--expose-gc'],
				},
			},
			environment: 'node',
			reporters: ['default'],
		},

		define: {
			TEST: JSON.stringify(true),
		},
	};
});
