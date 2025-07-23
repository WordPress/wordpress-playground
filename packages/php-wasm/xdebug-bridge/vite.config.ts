/// <reference types="vitest" />
import { defineConfig } from 'vite';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';

export default defineConfig({
	cacheDir: '../../../node_modules/.vite/php-wasm-xdebug-bridge',

	plugins: [
		viteTsConfigPaths({
			root: '../../../',
		}),
	],

	test: {
		environment: 'node',
		globals: true,
		reporters: ['default'],
	},
});
