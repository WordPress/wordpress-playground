/// <reference types="vitest" />
import path from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteIgnoreImports } from '../../vite-extensions/vite-ignore-imports';
// eslint-disable-next-line @nx/enforce-module-boundaries
import viteGlobalExtensions from '../../vite-extensions/vite-global-extensions';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { getExternalModules } from '../../vite-extensions/vite-external-modules';

export default defineConfig(({ command }) => {
	return {
		cacheDir: '../../../node_modules/.vite/php-wasm',

		plugins: [
			viteTsConfigPaths({
				root: '../../../',
			}),
			dts({
				entryRoot: 'src',
				tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
				pathsToAliases: false,
			}),
			viteIgnoreImports({
				extensions: ['wasm', 'so', 'dat'],
			}),
			/**
			 * Vite can't extract static asset in the library mode:
			 * https://github.com/vitejs/vite/issues/3295
			 *
			 * This workaround replaces the actual php_5_6.js modules paths used
			 * in the dev mode with their filenames. Then, the filenames are marked
			 * as external further down in this config. As a result, the final
			 * bundle contains literal `import('php_5_6.js')` and
			 * `import('php_5_6.wasm')` statements which allows the consumers to use
			 * their own loaders.
			 *
			 * This keeps the dev mode working AND avoids inlining 5mb of
			 * wasm via base64 in the final bundle.
			 */
			{
				name: 'preserve-php-loaders-imports',

				resolveDynamicImport(specifier): string | void {
					if (
						command === 'build' &&
						typeof specifier === 'string' &&
						specifier.match(/php_\d_\d\.js$/)
					) {
						/**
						 * The ../ is weird but necessary to make the final build say
						 * import("./php/jspi/php_8_2.js")
						 * and not
						 * import("php/jspi/php_8_2.js")
						 *
						 * The slice(-3) will ensure the 'php/jspi/'
						 * portion of the path is preserved.
						 */
						return '../' + specifier.split('/').slice(-3).join('/');
					}
				},
			},
			{
				name: 'preserve-data-loaders-imports',

				resolveDynamicImport(specifier): string | void {
					if (
						command === 'build' &&
						typeof specifier === 'string' &&
						specifier.match(/icu\.dat$/)
					) {
						/**
						 * The ../../../ is weird but necessary to make the final build say
						 * import("./shared/icu.dat")
						 * and not
						 * import("shared/icu.dat")
						 *
						 * The slice(-2) will ensure the 'shared/'
						 * portion of the path is preserved.
						 */
						return (
							'../../../' +
							specifier.split('/').slice(-2).join('/')
						);
					}
				},
			},
			{
				name: 'preserve-extension-loaders-imports',

				resolveDynamicImport(specifier): string | void {
					if (
						command === 'build' &&
						typeof specifier === 'string' &&
						specifier.match(/intl\.so$/)
					) {
						/**
						 * The ../../../ is weird but necessary to make the final build say
						 * import("./php/{mode}/extensions/intl/{php_version}/intl.so")
						 * and not
						 * import("php/{mode}/extensions/intl/{php_version}/intl.so")
						 *
						 * The slice(-6) will ensure the 'php/{mode}/extensions/intl/{php_version}'
						 * portion of the path is preserved.
						 */
						return (
							'../../../' +
							specifier.split('/').slice(-6).join('/')
						);
					}
				},
			},

			...viteGlobalExtensions,
		],

		// Configuration for building your library.
		// See: https://vitejs.dev/guide/build.html#library-mode
		build: {
			lib: {
				// Could also be a dictionary or array of multiple entry points.
				entry: 'src/index.ts',
				name: 'php-wasm-web',
				fileName: 'index',
				formats: ['es', 'cjs'],
			},
			sourcemap: true,
			rollupOptions: {
				// Don't bundle the PHP loaders in the final build. See
				// the preserve-php-loaders-imports plugin above.
				external: [
					/php_\d_\d.js$/,
					/icu.dat$/,
					/intl.so$/,
					...getExternalModules(),
				],
			},
		},

		// TODO : move Vitest tests to Playwright tests inside test directory
		test: {
			globals: true,
			environment: 'node',
			reporters: ['default'],
		},
	};
});
