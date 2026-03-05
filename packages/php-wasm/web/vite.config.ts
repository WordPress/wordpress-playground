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
	root: __dirname,
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
		 * This transforms rewrite dynamic import paths so they work from the dist output.
		 *
		 * Why the '../../../' prefix? Rollup computes the final import path relative to
		 * where the source file was located. Since everything gets bundled into
		 * index.js at the dist root, we need to "climb out" of the source directory
		 * structure. Rollup then normalizes '../../../foo' to './foo' in the output.
		 */
		viteExternalDynamicImports([
			{
				// Source: src/lib/extensions/intl/with-intl.ts
				// Input:  './lib/extensions/intl/shared/icu.dat'
				// Output: './shared/icu.dat'
				regex: /icu\.dat$/,
				transform: (specifier) => `../../../${specifier}`,
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
			// Don't bundle the PHP loaders or extensions in the final build.
			// PHP loaders are now in version-specific packages like @php-wasm/web-8-4
			external: [
				/^@php-wasm\/web-\d+-\d+$/,
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
