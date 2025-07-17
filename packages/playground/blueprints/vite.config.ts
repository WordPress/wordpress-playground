/// <reference types="vitest" />
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';

import dts from 'vite-plugin-dts';
import { join } from 'path';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { getExternalModules } from '../../vite-extensions/vite-external-modules';

const path = (filename: string) => new URL(filename, import.meta.url).pathname;
export default defineConfig({
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
			name: 'use-correct-blueprints-phar-file-url-in-vitest-environment',
			/**
			 * When ran inside the `blueprints.phar` package, vitest resolves
			 * `blueprints.phar?url` as `/public/blueprints.phar?url`. However, when ran
			 * inside other packages, it resolves as `/@fs/full/path/to/blueprints.phar`.
			 *
			 * This plugin ensures that the `blueprints.phar` file is always consistently
			 * resolved as the latter.
			 */
			transform(code, id) {
				if (id.match(new RegExp(`/blueprints\\.phar\\?url`))) {
					const fullyQualifiedPath = '/@fs' + path(id.split('?')[0]);
					return `export default ${JSON.stringify(
						fullyQualifiedPath
					)};`;
				}
				return code;
			},
		} as Plugin,
	],

	// Uncomment this if you are using workers.
	// worker: {
	//  plugins: [
	//    viteTsConfigPaths({
	//      root: '../../../',
	//    }),
	//  ],
	// },

	// Configuration for building your library.
	// See: https://vitejs.dev/guide/build.html#library-mode
	build: {
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
