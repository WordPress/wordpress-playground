/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { join } from 'path';
import dts from 'vite-plugin-dts';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { remoteDevServerHost, remoteDevServerPort } from '../build-config';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-ts-config-paths';

const path = (filename: string) => new URL(filename, import.meta.url).pathname;
const plugins = [
	viteTsConfigPaths({
		root: '../../../',
	}),
	dts({
		entryRoot: 'src',
		tsConfigFilePath: join(__dirname, 'tsconfig.lib.json'),
		skipDiagnostics: true,
	}),
];
export default defineConfig({
	assetsInclude: ['**/*.wasm', '*.data'],
	cacheDir: '../../../node_modules/.vite/playground',

	css: {
		modules: {
			localsConvention: 'camelCaseOnly',
		},
	},

	preview: {
		port: remoteDevServerPort - 100,
		host: remoteDevServerHost,
	},

	server: {
		port: remoteDevServerPort,
		host: remoteDevServerHost,
		fs: {
			// Allow serving files from one level up to the project root
			allow: ['./'],
		},
	},

	plugins,

	worker: {
		format: 'es',
		plugins,
		rollupOptions: {
			output: {
				// Ensure the service worker always has the same name
				entryFileNames: (chunkInfo: any) => {
					if (chunkInfo.name === 'service-worker') {
						return 'sw.js';
					}
					return '[name]-[hash].js';
				},
			},
		},
	},

	// Configuration for building your library.
	// See: https://vitejs.dev/guide/build.html#library-mode
	build: {
		assetsInlineLimit: 0,
		rollupOptions: {
			input: {
				wordpress: path('/remote.html'),
			},
		},
	},

	test: {
		globals: true,
		cache: {
			dir: '../../../node_modules/.vitest',
		},
		environment: 'jsdom',
		include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
	},
});
