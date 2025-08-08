/// <reference types="vitest" />
import fs from 'node:fs';
import { defineConfig } from 'vite';

import dts from 'vite-plugin-dts';
import { join } from 'path';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { getExternalModules } from '../../vite-extensions/vite-external-modules';

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

		{
			name: 'base64-loader',
			transform(_: any, id: string) {
				const url = new URL(id, 'file://');
				if (!url.searchParams.has('base64')) return null;
				const path = url.pathname;

				const data = fs.readFileSync(path);
				const base64 = data.toString('base64');

				return `export default '${base64}';`;
			},
		},
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
		environment: 'node',
		include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
		reporters: ['default'],
		setupFiles: ['./src/vitest-setup-file.ts'],
	},
});
