/// <reference types='vitest' />
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import dts from 'vite-plugin-dts';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { getExternalModules } from '../../vite-extensions/vite-external-modules';

const path = (filename: string) => new URL(filename, import.meta.url).pathname;
export default defineConfig({
	assetsInclude: ['**/*.wasm', '**/*.dat', '*.zip'],
	cacheDir: '../../../node_modules/.vite/playground-wordpress',
	plugins: [
		viteTsConfigPaths({
			root: '../../../',
		}),
		dts({
			entryRoot: 'src',
			tsconfigPath: path('tsconfig.lib.json'),
			pathsToAliases: false,
		}),
		{
			name: 'use-correct-wp-data-file-url-in-vitest-environment',
			/**
			 * When ran inside the `wordpress` package, vitest resolves
			 * `wp-6-4.data?url` as `/src/wordpress/wp-6-4.data?url`. However, when ran
			 * inside other packages, it resolves as `/@fs/full/path/to/wp-6-4.data`.
			 *
			 * This plugin ensures that the `wp-6-4.data` file is always consistently
			 * resolved as the latter.
			 */
			transform(code, id) {
				if (id.match(new RegExp(`/wp-\\d.\\d\\.data\\?url`))) {
					const fullyQualifiedPath = '/@fs' + path(id.split('?')[0]);
					return `export default ${JSON.stringify(
						fullyQualifiedPath
					)};`;
				}
				return code;
			},
		} as Plugin,
	],

	build: {
		lib: {
			// Could also be a dictionary or array of multiple entry points.
			entry: 'src/index.ts',
			name: 'playground-wordpress',
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

	test: {
		globals: true,
		cache: {
			dir: '../../../node_modules/.vitest',
		},
		environment: 'node',
		include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
		reporters: ['default'],
	},
});
