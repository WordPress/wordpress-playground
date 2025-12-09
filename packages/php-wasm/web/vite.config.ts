/// <reference types="vitest" />
import path from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteIgnoreImports } from '../../vite-extensions/vite-ignore-imports';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { vitePreserveLoadersImports } from '../../vite-extensions/vite-preserve-loaders-imports';
// eslint-disable-next-line @nx/enforce-module-boundaries
import viteGlobalExtensions from '../../vite-extensions/vite-global-extensions';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { getExternalModules } from '../../vite-extensions/vite-external-modules';

export default defineConfig({
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
		vitePreserveLoadersImports([
			{
				regex: /php_\d_\d\.js$/,
				/*
				 * ../ lifts the import located file up to the dist entryRoot
				 * web/src/lib/get-php-loader-module.ts > web/src/get-php-loader-module.ts
				 *
				 * slice(-3) strips the `public` directory from the path
				 * web/public/php/jspi/php_8_4.js > ./web/php/jspi/php_8_4.js
				 */
				transform: (specifier) =>
					`../${specifier.split('/').slice(-3).join('/')}`,
			},
			{
				regex: /intl\.so$/,
				/*
				 * ../../../ lifts the import located file to the dist entryRoot
				 * web/src/lib/extensions/intl/get-intl-loader-module.ts > web/src/get-intl-loader-module.ts
				 *
				 * slice(-6) strips the `public` directory from the path
				 * web/public/php/jspi/extensions/8_4/intl/intl.so > ./web/php/jspi/extensions/8_4/intl/intl.so
				 */
				transform: (specifier) =>
					`../../../${specifier.split('/').slice(-6).join('/')}`,
			},
			{
				regex: /icu\.dat$/,
				/*
				 * ../../../ lifts the import located file to the dist entryRoot
				 * web/src/lib/extensions/intl/with-intl.ts > web/src/with-intl.ts
				 *
				 * slice(-2) strips the `public` directory from the path
				 * web/public/shared/icu.dat > ./web/shared/icu.dat
				 */
				transform: (specifier) =>
					`../../../${specifier.split('/').slice(-2).join('/')}`,
			},
		]),
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
});
