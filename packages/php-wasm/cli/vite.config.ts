/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
// eslint-disable-next-line @nx/enforce-module-boundaries
import viteGlobalExtensions from '../../vite-extensions/vite-global-extensions';

export default defineConfig({
	root: __dirname,
	assetsInclude: ['**/*.ini'],
	cacheDir: '../../../node_modules/.vite/php-cli',

	plugins: [nxViteTsPaths(), ...viteGlobalExtensions],

	// Configuration for building your library.
	// See: https://vitejs.dev/guide/build.html#library-mode
	build: {
		assetsInlineLimit: 0,
		target: 'es2020',
		sourcemap: true,
		rollupOptions: {
			external: [
				'@php-wasm/node',
				'@php-wasm/universal',
				'assert',
				'crypto',
				'net',
				'fs',
				'path',
				'child_process',
				'http',
				'stream',
				'timers',
				'tls',
				'url',
				'util',
				'dns',
				'ws',
				'os',
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
		environment: 'node',
		include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
		reporters: ['default'],
	},

	define: {
		'process.env': 'process.env',
	},
});
