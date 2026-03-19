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
	root: __dirname,
	cacheDir: '../../../node_modules/.vite/playground-mcp',

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

	build: {
		lib: {
			entry: {
				index: 'src/index.ts',
				client: 'src/client.ts',
			},
			name: 'playground-mcp',
			formats: ['es', 'cjs'],
		},
		sourcemap: true,
		rollupOptions: {
			external: getExternalModules(),
			output: {
				banner: (chunk) =>
					chunk.fileName === 'index.js' ? '#!/usr/bin/env node' : '',
			},
		},
	},
});
