/// <reference types='vitest' />
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';
import { getExternalModules } from '../../vite-extensions/vite-external-modules';
import viteGlobalExtensions from '../../vite-extensions/vite-global-extensions';

const path = (filename: string) => new URL(filename, import.meta.url).pathname;

export default defineConfig({
	root: __dirname,
	cacheDir: '../../../node_modules/.vite/playground-mariadb',
	plugins: [
		viteTsConfigPaths({ root: '../../../' }),
		dts({
			entryRoot: 'src',
			tsconfigPath: path('tsconfig.lib.json'),
			pathsToAliases: false,
		}),
		...viteGlobalExtensions,
	],
	build: {
		lib: {
			entry: 'src/index.ts',
			name: 'playground-mariadb',
			fileName: 'index',
			formats: ['es', 'cjs'],
		},
		sourcemap: true,
		rollupOptions: {
			external: getExternalModules(),
		},
	},
	test: {
		globals: true,
		cache: { dir: '../../../node_modules/.vitest' },
		environment: 'node',
		include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
		reporters: ['default'],
	},
});
