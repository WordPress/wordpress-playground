/// <reference types="vitest" />
import fs from 'fs';
import { defineConfig, Plugin } from 'vite';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';
// eslint-disable-next-line @nx/enforce-module-boundaries
import ignoreWasmImports from '../ignore-wasm-imports';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { getExternalModules } from '../../vite-extensions/vite-external-modules';
import path from 'path';

export default defineConfig({
	base: '/',

	cacheDir: '../../../node_modules/.vite/packages-playground-storage',

	css: {
		modules: {
			localsConvention: 'camelCaseOnly',
		},
	},

	plugins: [
		/**
		 * A clunky fix for these import errors:
		 *
		 * import { compareStrings } from './compareStrings' to work.
		 *
		 * Error: Cannot find module '/Users/cloudnik/www/Automattic/core/plugins/playground/node_modules/isomorphic-git/src/utils/compareStrings' imported from /Users/cloudnik/www/Automattic/core/plugins/playground/node_modules/isomorphic-git/src/utils/comparePath.js'
		 *
		 * @TODO – fix it globally, ideally remove the special `resolveplugin:` prefix.
		 * It just works with `bun test FWIW.
		 */
		{
			name: 'resolve-js-imports-when-path-does-not-end-with-js-within-node-modules',
			enforce: 'pre',
			resolveId(id, importedFrom) {
				if (id.startsWith('resolveplugin:')) {
					id = id.replace('resolveplugin:', '');
				}
				if (importedFrom?.startsWith('resolveplugin:')) {
					importedFrom = importedFrom.replace('resolveplugin:', '');
				}
				if (
					!id.includes('isomorphic-git') &&
					!importedFrom?.includes('isomorphic-git')
				) {
					return;
				}

				if (id.startsWith('/')) {
					return {
						id: 'resolveplugin:' + id,
					};
				}

				if (id.startsWith('isomorphic-git')) {
					return {
						id:
							'resolveplugin:' +
							path.join(__dirname, `../../../node_modules/${id}`),
					};
				}

				if (!id.startsWith('.')) {
					return;
				}

				if (!id.startsWith('/')) {
					return {
						id:
							'resolveplugin:' +
							path.join(
								importedFrom ? path.dirname(importedFrom) : '',
								id
							),
					};
				}
				return {
					id: 'resolveplugin:' + id,
				};
			},
			load(id) {
				if (id.startsWith('resolveplugin:')) {
					id = id.replace('resolveplugin:', '');
					if (!fs.existsSync(id) && fs.existsSync(id + '.js')) {
						id += '.js';
					}
					return fs.readFileSync(id, 'utf-8');
				}
			},
		} as Plugin,
		viteTsConfigPaths({
			root: '../../../',
		}),
		ignoreWasmImports(),
	],

	// Configuration for building your library.
	// See: https://vitejs.dev/guide/build.html#library-mode
	build: {
		lib: {
			// Could also be a dictionary or array of multiple entry points.
			entry: 'src/index.ts',
			name: 'playground-storage',
			fileName: 'index',
			// Change this to the formats you want to support.
			// Don't forgot to update your package.json as well.
			formats: ['es', 'cjs'],
		},
		rollupOptions: {
			// External packages that should not be bundled into your library.
			external: getExternalModules(),
		},
	},

	test: {
		globals: true,
		cache: {
			dir: '../../../node_modules/.vitest',
		},
		environment: 'jsdom',
		setupFiles: ['./src/vitest-setup-file.ts'],
		include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
	},
});
