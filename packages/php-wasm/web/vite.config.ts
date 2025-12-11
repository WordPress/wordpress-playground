/// <reference types="vitest" />
import path from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteIgnoreImports } from '../../vite-extensions/vite-ignore-imports';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteExternalDynamicImports } from '../../vite-extensions/vite-external-dynamic-imports';
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
		/*
		 * These transforms rewrite dynamic import paths so they work from the dist output.
		 *
		 * Each transform does two things:
		 * 1. slice(-N) extracts the path segments we want to keep (strips the 'public' prefix)
		 * 2. The '../' prefix compensates for the source file's directory depth
		 *
		 * Why the '../' prefix? Rollup computes the final import path relative to
		 * where the source file was located. Since everything gets bundled into
		 * index.js at the dist root, we need to "climb out" of the source directory
		 * structure. Rollup then normalizes '../foo' to './foo' in the output.
		 *
		 * Example for php_8_4.js:
		 *   Source file: src/lib/get-php-loader-module.ts (2 levels deep: src/lib/)
		 *   Input:       '../../public/php/jspi/php_8_4.js'
		 *   slice(-3):   'php/jspi/php_8_4.js'
		 *   With '../':  '../php/jspi/php_8_4.js'
		 *   Output:      './php/jspi/php_8_4.js' (rollup normalizes for dist root)
		 */
		viteExternalDynamicImports([
			{
				// Source: src/lib/get-php-loader-module.ts (1 dir from src/)
				// Input:      '../../public/php/jspi/php_8_4.js'
				// slice(-3):  'php/jspi/php_8_4.js'
				// With '../': '../php/jspi/php_8_4.js'
				// Output:     './php/jspi/php_8_4.js'
				regex: /php_\d_\d\.js$/,
				transform: (specifier) =>
					`../${specifier.split('/').slice(-3).join('/')}`,
			},
			{
				// Source: src/lib/extensions/intl/get-intl-extension-module.ts (3 dirs from src/)
				// Input:          '../../../../public/php/jspi/extensions/intl/8_4/intl.so'
				// slice(-6):      'php/jspi/extensions/intl/8_4/intl.so'
				// With '../../../': '../../../php/jspi/extensions/intl/8_4/intl.so'
				// Output:         './php/jspi/extensions/intl/8_4/intl.so'
				regex: /intl\.so$/,
				transform: (specifier) =>
					`../../../${specifier.split('/').slice(-6).join('/')}`,
			},
			{
				// Source: src/lib/extensions/intl/with-intl.ts (3 dirs from src/)
				// Input:          '../../../../public/shared/icu.dat'
				// slice(-2):      'shared/icu.dat'
				// With '../../../': '../../../shared/icu.dat'
				// Output:         './shared/icu.dat'
				regex: /icu\.dat$/,
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
			// the viteExternalDynamicImports plugin above.
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
