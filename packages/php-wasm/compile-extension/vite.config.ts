/// <reference types="vitest" />
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { join } from 'path';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
// eslint-disable-next-line @nx/enforce-module-boundaries
import viteGlobalExtensions from '../../vite-extensions/vite-global-extensions';

export default defineConfig({
	root: __dirname,
	cacheDir: '../../../node_modules/.vite/php-wasm-compile-extension',
	plugins: [
		dts({
			entryRoot: 'src',
			tsconfigPath: join(__dirname, 'tsconfig.lib.json'),
			pathsToAliases: false,
		}),
		nxViteTsPaths(),
		...viteGlobalExtensions,
	],
	build: {
		target: 'es2021',
		sourcemap: true,
		rollupOptions: {
			external: [
				'child_process',
				'crypto',
				'fs',
				'fs/promises',
				'isomorphic-git',
				'isomorphic-git/http/node',
				'node:child_process',
				'node:crypto',
				'node:fs',
				'node:fs/promises',
				'node:os',
				'node:path',
				'node:url',
				'os',
				'path',
				'url',
				'yargs',
				'yargs/helpers',
			],
			input: join(__dirname, 'src/cli.ts'),
			output: {
				format: 'esm',
				entryFileNames: 'cli.js',
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
