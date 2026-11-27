import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { join } from 'path';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { getExternalModules } from '../../vite-extensions/vite-external-modules';

export default defineConfig({
	root: __dirname,
	cacheDir: '../../../node_modules/.vite/playground-personal-wp-mcp',
	resolve: {
		alias: {
			'@wp-playground/mcp/api': join(__dirname, '../mcp/src/api.ts'),
		},
	},

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
			name: 'playground-personal-wp-mcp',
			formats: ['es', 'cjs'],
		},
		sourcemap: true,
		rollupOptions: {
			external: [
				...getExternalModules(),
				/^@modelcontextprotocol\/sdk\//,
				/^zod\//,
			],
			output: {
				banner: (chunk) =>
					chunk.fileName === 'cli.js' ? '#!/usr/bin/env node' : '',
			},
		},
	},

	test: {
		globals: true,
		cache: {
			dir: '../../../node_modules/.vitest',
		},
		environment: 'node',
		include: [
			'tests/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
		],
		reporters: ['default'],
	},
});
