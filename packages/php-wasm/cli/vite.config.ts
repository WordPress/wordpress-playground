/// <reference types="vitest" />
import { defineConfig } from 'vite';
import viteTsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig(() => {
	return {
		assetsInclude: ['**/*.ini'],
		cacheDir: '../../../node_modules/.vite/php-cli',

		plugins: [
			viteTsConfigPaths({
				root: '../../../',
			}),
		],

		// Configuration for building your library.
		// See: https://vitejs.dev/guide/build.html#library-mode
		build: {
			assetsInlineLimit: 0,
			target: 'es2020',
			rollupOptions: {
				external: [
					'@php-wasm/node',
					'net',
					'fs',
					'path',
					'child_process',
					'http',
					'tls',
					'util',
					'dns',
					'ws',
				],
				input: 'packages/php-wasm/cli/src/main.ts',
				output: {
					format: 'esm',
					entryFileNames: '[name].js',
				},
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
