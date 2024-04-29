/// <reference types="vitest" />
// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-ts-config-paths';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteWasmLoader } from '../../vite-wasm-loader';

export default {
	base: '/',

	cacheDir: '../../../node_modules/.vite/packages-playground-sync',

	css: {
		modules: {
			localsConvention: 'camelCaseOnly',
		},
	},

	plugins: [
		viteTsConfigPaths({
			root: '../../../',
		}),
		viteWasmLoader,
	],

	// Configuration for building your library.
	// See: https://vitejs.dev/guide/build.html#library-mode
	build: {
		lib: {
			// Could also be a dictionary or array of multiple entry points.
			entry: 'src/index.ts',
			name: 'playground-sync',
			fileName: 'index',
			// Change this to the formats you want to support.
			// Don't forgot to update your package.json as well.
			formats: ['es', 'cjs'],
		},
		rollupOptions: {
			// External packages that should not be bundled into your library.
			external: [],
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
};
