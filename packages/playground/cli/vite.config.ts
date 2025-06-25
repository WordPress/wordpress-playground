/// <reference types="vitest" />
import { join } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { getExternalModules } from '../../vite-extensions/vite-external-modules';

const plugins = [
	dts({
		entryRoot: 'src',
		tsconfigPath: join(__dirname, 'tsconfig.lib.json'),
		pathsToAliases: false,
	}),

	viteTsConfigPaths({
		root: '../../../',
	}),
];

const external = [
	...getExternalModules(),
	'@php-wasm/node',
	'@php-wasm/web',
	'@php-wasm/universal',
	'@php-wasm/logger',
	'@php-wasm/progress',
	'@php-wasm/util',
	'@wp-playground/wordpress',
	'@wp-playground/common',
	'@wp-playground/blueprints',
];

export default defineConfig({
	base: './',
	assetsInclude: ['**/*.ini'],
	cacheDir: '../../../node_modules/.vite/php-cli',

	plugins,

	worker: {
		format: 'es',
		plugins: () => plugins,
		rollupOptions: {
			external,
			output: {
				entryFileNames: (/* chunkInfo: any */) => {
					return '[name]-[hash].js';
				},
			},
		},
	},

	// Configuration for building your library.
	// See: https://vitejs.dev/guide/build.html#library-mode
	build: {
		assetsInlineLimit: 0,
		target: 'es2020',
		sourcemap: true,
		rollupOptions: {
			external,
		},
		lib: {
			entry: {
				index: 'src/index.ts',
				cli: 'src/cli.ts',
				'worker-thread': 'src/worker-thread.ts',
			},
			name: 'playground-cli',
			formats: ['es', 'cjs'],
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
		testTimeout: 15000, // Increase timeout to ensure CLI tests can download WordPress
	},
});
