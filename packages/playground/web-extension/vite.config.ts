/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
	assetsInclude: ['**/*.ini'],
	cacheDir: '../../../node_modules/.vite/web-extension',

	plugins: [nxViteTsPaths()],

	// Configuration for building your library.
	// See: https://vitejs.dev/guide/build.html#library-mode
	optimizeDeps: {
		include: ['@php-wasm/web'],
	},
	build: {
		assetsInlineLimit: 0,
		target: 'modules',
		commonjsOptions: {
			include: [/php-wasm/, /node_modules/],
		},
		rollupOptions: {
			external: [
				'yargs',
				'express',
				'crypto',
				'os',
				'net',
				'fs',
				'fs-extra',
				'path',
				'child_process',
				'http',
				'path',
				'tls',
				'util',
				'dns',
				'ws',
			],
			input: 'packages/playground/web-extension/src/playground-loader.ts',
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
});
