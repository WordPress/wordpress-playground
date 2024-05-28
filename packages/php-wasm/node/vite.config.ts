/**
 * For Vitest only! The module is built with esbuild which is configured
 * in project.json.
 */
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import viteTsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig(function () {
	return {
		cacheDir: '../../../node_modules/.vite/php-wasm',

		plugins: [
			viteTsConfigPaths({
				root: '../../../',
			}),
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
			rollupOptions: {
				// Don't bundle the PHP loaders in the final build. See
				// the preserve-php-loaders-imports plugin above.
				external: [
					'net',
					'fs',
					'path',
					'http',
					'tls',
					'util',
					'dns',
					'ws',
				],
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
			environment: 'jsdom',
			reporters: 'dot',
			include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
		},

		define: {
			TEST: JSON.stringify(true),
		},
	};
});
