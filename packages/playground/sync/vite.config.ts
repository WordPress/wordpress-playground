/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteTsConfigPaths from 'vite-tsconfig-paths';
// eslint-disable-next-line @nx/enforce-module-boundaries
import ignoreWasmImports from '../ignore-wasm-imports';

export default defineConfig(() => {
	return {
		base: '/',

		cacheDir: '../../../node_modules/.vite/packages-playground-sync',

		css: {
			modules: {
				localsConvention: 'camelCaseOnly',
			},
		},

		preview: {
			port: 6400,
			host: '127.0.0.1',
		},

		server: {
			port: 6400,
			host: '127.0.0.1',
			fs: {
				strict: false, // Serve files from the other project directories.
			},
		},

		plugins: [
			react(),
			viteTsConfigPaths({
				root: '../../../',
			}),
			ignoreWasmImports(),
		],

		// Configuration for building your library.
		// See: https://vitejs.dev/guide/build.html#library-mode
		build: {
			rollupOptions: {
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
});
