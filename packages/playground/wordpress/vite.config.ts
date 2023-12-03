/// <reference types='vitest' />
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
	cacheDir: '../../../node_modules/.vite/playground-wordpress',

	plugins: [
		nxViteTsPaths(),
		dts({
			entryRoot: 'src',
			tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
		}),
	],

	build: {
		lib: {
			entry: 'src/index.ts',
			name: 'playground-wordpress',
			fileName: 'index',
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
		environment: 'node',
		include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
	},
});
