/// <reference types="vitest" />
import { defineConfig } from 'vite';
import viteTsConfigPaths from 'vite-tsconfig-paths';
import dts from 'vite-plugin-dts';
import { join } from 'path';
// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import ignoreWasmImports from '../ignore-wasm-imports';

export default defineConfig({
	cacheDir: '../../../node_modules/.vite/playground-client',
	plugins: [
		viteTsConfigPaths({
			root: '../../../',
		}),
		dts({
			entryRoot: 'src',
			tsConfigFilePath: join(__dirname, 'tsconfig.lib.json'),
			skipDiagnostics: true,
		}),
		ignoreWasmImports(),
	],

	// Configuration for building your library.
	// See: https://vitejs.dev/guide/build.html#library-mode
	build: {
		lib: {
			// Could also be a dictionary or array of multiple entry points.
			entry: './src/index.ts',
			name: 'playground-client',
			fileName: 'index',
			formats: ['es'],
		},
		rollupOptions: {
			// External packages that should not be bundled into your library.
			external: ['comlink', '@wp-playground/php-wasm-progress'],
		},
	},

	test: {
		globals: true,
		cache: {
			dir: '../../../node_modules/.vitest',
		},
		environment: 'jsdom',
		include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
	},
});
