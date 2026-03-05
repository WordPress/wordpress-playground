/// <reference types="vitest" />
import { join } from 'path';
import { defineConfig, type Plugin } from 'vite';
import path from 'path';
import dts from 'vite-plugin-dts';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';
// eslint-disable-next-line @nx/enforce-module-boundaries
import viteGlobalExtensions from '../../vite-extensions/vite-global-extensions';

export default defineConfig({
	root: __dirname,
	cacheDir: '../../../node_modules/.vite/php-wasm-xdebug-bridge',

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
		{
			name: 'import-url',
			enforce: 'pre',

			resolveId(id: string, importer: string): any {
				if (id.startsWith('import-url:')) {
					return id;
				}

				if (!path.isAbsolute(id) && id.endsWith('?url')) {
					const filepath = path.resolve(path.dirname(importer), id);
					return `import-url:${filepath}`;
				}

				return null;
			},

			load(id: string): any {
				if (id.startsWith('import-url:')) {
					const encodedPath = id.slice('import-url:'.length);
					const filePath = encodedPath.replace('?url', '');

					return {
						code: `export default ${JSON.stringify(filePath)};`,
						map: null,
					};
				}

				return null;
			},
		} as Plugin,
	],

	build: {
		lib: {
			entry: {
				index: 'src/index.ts',
				cli: 'src/cli.ts',
			},
			name: 'php-wasm-xdebug-bridge',
			formats: ['es', 'cjs'],
		},
		rollupOptions: {
			external: [
				'assert',
				'crypto',
				'fs',
				'net',
				'path',
				'stream',
				'timers',
				'url',
				'util',
				'ws',
			],
			output: {
				exports: 'named',
			},
		},
		sourcemap: false,
		target: 'node20',
	},

	test: {
		environment: 'node',
		globals: true,
		reporters: ['default'],
	},
});
