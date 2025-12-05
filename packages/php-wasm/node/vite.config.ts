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

const urlRE = /\?url$/;

export default defineConfig(function () {
	return {
		cacheDir: '../../../node_modules/.vite/php-wasm',

		plugins: [
			viteTsConfigPaths({
				root: '../../../',
			}),
			{
				name: 'import-url',
				enforce: 'pre',

				resolveId(id, importer) {
					if (importer && !path.isAbsolute(id) && urlRE.test(id)) {
						const filepath = path.resolve(
							path.dirname(importer),
							id.replace(urlRE, '')
						);
						return `import-url:${filepath}`;
					}
					return null;
				},

				load(id) {
					if (id.startsWith('import-url:')) {
						const filePath = id.slice('import-url:'.length);
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
				// Don't bundle the PHP loaders in the final build. See
				// the preserve-php-loaders-imports plugin above.
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
			deps: {
				inline: [
					'@php-wasm/universal',
					'@php-wasm/node',
					'@php-wasm/logger',
					'@php-wasm/progress',
				],
			},
		},

		ssr: {
			noExternal: [
				'@php-wasm/universal',
				'@php-wasm/node',
				'@php-wasm/logger',
				'@php-wasm/progress',
			],
		},

		define: {
			TEST: JSON.stringify(true),
		},
	};
});
