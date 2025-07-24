/// <reference types="vitest" />
import { join } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';

export default defineConfig({
	cacheDir: '../../../node_modules/.vite/php-wasm-xdebug-bridge',

	plugins: [
		dts({
			entryRoot: 'src',
			tsconfigPath: join(__dirname, 'tsconfig.lib.json'),
			pathsToAliases: false,
		}),

		viteTsConfigPaths({
			root: '../../../',
		}),
	],

	build: {
		lib: {
			entry: {
				index: 'src/index.ts',
				cli: 'src/cli.ts',
			},
			name: 'php-wasm-xdebug-bridge',
			formats: ['es', 'cjs'],
		},
		rollupOptions: {
			external: [
				'assert',
				'fs',
				'net',
				'path',
				'stream',
				'timers',
				'url',
				'util',
				'ws',
			],
			output: {
				exports: 'named',
			},
		},
		sourcemap: false,
		target: 'node20',
	},

	test: {
		environment: 'node',
		globals: true,
		reporters: ['default'],
	},
});
