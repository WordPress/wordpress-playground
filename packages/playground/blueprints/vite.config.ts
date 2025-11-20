/// <reference types="vitest" />
import { defineConfig } from 'vite';

import dts from 'vite-plugin-dts';
import { join } from 'path';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { getExternalModules } from '../../vite-extensions/vite-external-modules';
// eslint-disable-next-line @nx/enforce-module-boundaries
import viteGlobalExtensions from '../../vite-extensions/vite-global-extensions';

export default defineConfig({
	assetsInclude: ['**/*.phar'],
	cacheDir: '../../../node_modules/.vite/playground-blueprints',

	plugins: [
		dts({
			entryRoot: 'src',
			tsconfigPath: join(__dirname, 'tsconfig.lib.json'),
			pathsToAliases: false,
		}),

		viteTsConfigPaths({
			root: '../../../',
		}),

		...viteGlobalExtensions,
	],

	// Configuration for building your library.
	// See: https://vitejs.dev/guide/build.html#library-mode
	build: {
		assetsInlineLimit: 0,
		lib: {
			// Could also be a dictionary or array of multiple entry points.
			entry: 'src/index.ts',
			name: 'playground-blueprints',
			fileName: 'index',

			// Change this to the formats you want to support.
			// Don't forgot to update your package.json as well.
			formats: ['es', 'cjs'],
		},
		sourcemap: true,
		rollupOptions: {
			external: getExternalModules(),
		},
	},
	resolve: {
		// @ts-ignore
		alias: {
			// This makes sure Vite doesn't stub it
			fs: false,
			'fs/promises': false,
		},
	},

	test: {
		globals: true,
		cache: {
			dir: '../../../node_modules/.vitest',
		},
		testTimeout: 10000,
		hookTimeout: 30000,
		environment: 'node',
		include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
		reporters: ['default'],
		setupFiles: ['./src/vitest-setup-file.ts'],
	},
});
