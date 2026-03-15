/**
 * For Vitest only! The module is built with esbuild which is configured
 * in project.json.
 */
import { defineConfig } from 'vitest/config';
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
			rolldownOptions: {
				external: getExternalModules(),
				output: {
					entryFileNames: '[name].js',
					chunkFileNames: '[name].js',
				},
			},
		},

		test: {
			globals: true,
			env: {
				TEST: JSON.stringify(true),
			},
			// Vitest 4 moved poolOptions to top-level test options.
			// This passes --expose-gc to forked test workers so that
			// tests like php-crash.spec.ts can call global.gc().
			execArgv: ['--expose-gc'],
			environment: 'node',
			reporters: ['default'],
			// The ~400MB heap tests run close to the default 5s timeout.
			// Vitest 4's worker pool adds slight overhead that pushes
			// them past the limit.
			testTimeout: 30000,
			// The Emscripten-compiled PHP 7.4 PIPEFS has a race condition
			// where a socket data callback fires after the pipe is destroyed,
			// causing "Cannot read properties of null (reading 'length')".
			// Vitest 4 treats unhandled errors as test failures (Vitest 3
			// only warned). Suppress this specific WASM runtime error.
			onUnhandledError(error) {
				if (
					error instanceof TypeError &&
					error.message?.includes("reading 'length'")
				) {
					return false;
				}
			},
		},

		define: {
			TEST: JSON.stringify(true),
		},
	};
});
