/// <reference types="vitest" />
import { defineConfig } from 'vite';
import type { Plugin, ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';
// eslint-disable-next-line @nx/enforce-module-boundaries
import ignoreWasmImports from '../ignore-wasm-imports';
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
	websiteDevServerHost,
	websiteDevServerPort,
	remoteDevServerHost,
	remoteDevServerPort,
} from '../build-config';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { oAuthMiddleware } from './vite.oauth';
import { fileURLToPath } from 'node:url';
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildVersionPlugin } from '../../vite-extensions/vite-build-version';
import { websiteCachePathsPlugin } from '../../vite-extensions/vite-website-cache-paths';

const proxy = {
	'^/plugin-proxy': {
		target: 'https://playground.wordpress.net',
		changeOrigin: true,
		secure: true,
	},
};

const path = (filename: string) => new URL(filename, import.meta.url).pathname;
export default defineConfig(({ command, mode }) => {
	return {
		// Split traffic from this server on dev so that the iframe content and outer
		// content can be served from the same origin. In production it's already
		// the same host, but dev builds run two separate servers.
		// See proxy config above.
		base: mode === 'production' ? '/' : '/website-server/',

		cacheDir: '../../../node_modules/.vite/packages-playground-website',

		css: {
			modules: {
				localsConvention: 'camelCaseOnly',
			},
		},

		preview: {
			port: websiteDevServerPort,
			host: websiteDevServerHost,
			proxy,
		},

		server: {
			port: websiteDevServerPort,
			host: websiteDevServerHost,
			proxy: {
				...proxy,
				// Proxy requests to the remote content through this server for dev builds.
				// See base config below.
				'^[/]((?!website-server).)': {
					target: `http://${remoteDevServerHost}:${remoteDevServerPort}`,
				},
			},
			fs: {
				strict: false, // Serve files from the other project directories.
			},
		},

		plugins: [
			react({
				jsxRuntime: 'automatic',
			}),
			viteTsConfigPaths({
				root: '../../../',
			}),
			ignoreWasmImports(),
			buildVersionPlugin('website-config'),
			// GitHub OAuth flow
			{
				name: 'configure-server',
				configureServer(server: ViteDevServer) {
					server.middlewares.use(oAuthMiddleware);
				},
			},
			/**
			 * Copy the `.htaccess` file to the `dist` directory.
			 */
			{
				name: 'htaccess-plugin',
				apply: 'build',
				writeBundle({ dir: outputDir }) {
					const htaccessPath = path('.htaccess');

					if (existsSync(htaccessPath) && outputDir) {
						copyFileSync(
							htaccessPath,
							join(outputDir, '.htaccess')
						);
					}
				},
			} as Plugin,
			/**
			 * Copy the `blueprints.phar` file to the `dist/demos` directory.
			 */
			{
				name: 'blueprints-plugin',
				apply: 'build',
				writeBundle({ dir: outputDir }) {
					const blueprintsPath = path('demos/blueprints.phar');

					if (existsSync(blueprintsPath) && outputDir) {
						copyFileSync(
							blueprintsPath,
							join(outputDir, 'demos/blueprints.phar')
						);
					}
				},
			} as Plugin,
			/**
			 * Copy the `manifest.json` file to the `dist/` directory.
			 */
			{
				name: 'manifest-plugin-build',
				apply: 'build',
				writeBundle({ dir: outputDir }) {
					const manifestPath = path('./manifest.production.json');

					if (existsSync(manifestPath) && outputDir) {
						copyFileSync(
							manifestPath,
							join(outputDir, 'manifest.json')
						);
					}
				},
			} as Plugin,
			/**
			 * Merge cache manifest files into a single `cache-files.json` file.
			 */
			websiteCachePathsPlugin() as Plugin,
		],

		// Configuration for building your library.
		// See: https://vitejs.dev/guide/build.html#library-mode
		build: {
			target: 'esnext',
			rollupOptions: {
				input: {
					index: fileURLToPath(
						new URL('./index.html', import.meta.url)
					),
					'index.html': fileURLToPath(
						new URL('./demos/index.html', import.meta.url)
					),
					'wp-cli.html': fileURLToPath(
						new URL('./demos/wp-cli.html', import.meta.url)
					),
					'php-blueprints.html': fileURLToPath(
						new URL('./demos/php-blueprints.html', import.meta.url)
					),
					'sync.html': fileURLToPath(
						new URL('./demos/sync.html', import.meta.url)
					),
					'peer.html': fileURLToPath(
						new URL('./demos/peer.html', import.meta.url)
					),
					'time-traveling.html': fileURLToPath(
						new URL('./demos/time-traveling.html', import.meta.url)
					),
					'builder/builder.html': fileURLToPath(
						new URL('./builder/builder.html', import.meta.url)
					),
				},
				// output: {
				// 	entryFileNames: (assetInfo) => {
				// 		const isHTML = assetInfo?.facadeModuleId?.endsWith('.html');
				// 		if (isHTML) {
				// 			return '[name].html';
				// 		}
				// 		return '[name]-[hash].js';
				// 	},
				// },
				external: [],
			},
			manifest: 'website-cache-files.json',
		},

		test: {
			globals: true,
			cache: {
				dir: '../../../node_modules/.vitest',
			},
			environment: 'jsdom',
			include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
		},
	};
});
