/// <reference types="vitest" />
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { join } from 'path';
// eslint-disable-next-line @nx/enforce-module-boundaries
import ignoreWasmImports from '../ignore-wasm-imports';
// eslint-disable-next-line @nx/enforce-module-boundaries
import ignoreDataImports from '../ignore-data-imports';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { buildVersionPlugin } from '../../vite-extensions/vite-build-version';
// eslint-disable-next-line @nx/enforce-module-boundaries
import viteGlobalExtensions from '../../vite-extensions/vite-global-extensions';

export default defineConfig({
	cacheDir: '../../../node_modules/.vite/playground-client',
	plugins: [
		viteTsConfigPaths({
			root: '../../../',
		}),
		dts({
			entryRoot: 'src',
			tsconfigPath: join(__dirname, 'tsconfig.lib.json'),
			pathsToAliases: false,
		}),
		ignoreWasmImports(),
		ignoreDataImports(),
		...viteGlobalExtensions,
		buildVersionPlugin(),
	],

	// Configuration for building your library.
	// See: https://vitejs.dev/guide/build.html#library-mode
	build: {
		lib: {
			// Could also be a dictionary or array of multiple entry points.
			entry: './src/index.ts',
			name: 'playground-client',
			fileName: 'index',
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
	},
});
