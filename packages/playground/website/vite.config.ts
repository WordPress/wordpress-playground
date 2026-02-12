/// <reference types="vitest" />
import { defineConfig } from 'vite';
import type { CommonServerOptions, Plugin, ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteIgnoreImports } from '../../vite-extensions/vite-ignore-imports';
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
	websiteDevServerHost,
	websiteDevServerPort,
	remoteDevServerHost,
	remoteDevServerPort,
	websiteExtrasDevServerHost,
	websiteExtrasDevServerPort,
} from '../build-config';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { oAuthMiddleware } from './vite.oauth';
import { fileURLToPath } from 'node:url';
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { buildVersionPlugin } from '../../vite-extensions/vite-build-version';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { listAssetsRequiredForOfflineMode } from '../../vite-extensions/vite-list-assets-required-for-offline-mode';
// eslint-disable-next-line @nx/enforce-module-boundaries
import virtualModule from '../../vite-extensions/vite-virtual-module';
// eslint-disable-next-line @nx/enforce-module-boundaries
import viteGlobalExtensions from '../../vite-extensions/vite-global-extensions';

const proxy: CommonServerOptions['proxy'] = {
	'^/plugin-proxy': {
		target: 'https://playground.wordpress.net',
		changeOrigin: true,
		secure: true,
	},
};

const path = (filename: string) => new URL(filename, import.meta.url).pathname;
export default defineConfig(({ command, mode }) => {
	const corsProxyUrl =
		'CORS_PROXY_URL' in process.env
			? process.env.CORS_PROXY_URL
			: mode === 'production'
				? 'https://wordpress-playground-cors-proxy.net/?'
				: '/cors-proxy/?';

	return {
		root: __dirname,
		// Split traffic from this server on dev so that the iframe content and
		// outer content can be served from the same origin. In production it's
		// already the same host, but dev builds run two separate servers. See proxy
		// config above.
		base: mode === 'production' ? '/' : '/website-server/',

		assetsInclude: ['**/*.so', '**/*.dat'],

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
			allowedHosts: ['playground.test', 'playground-preview.test'],
			proxy: {
				...proxy,
				// Proxy CORS requests to the local PHP CORS proxy server.
				// This avoids Private Network Access (PNA) restrictions in Chrome
				// when making cross-origin requests between different local ports.
				'/cors-proxy': {
					target: 'http://127.0.0.1:5263',
					changeOrigin: true,
					rewrite: (path) =>
						path.replace(/^\/cors-proxy\/\?/, '/cors-proxy.php?'),
				},
				// Proxy requests to the website-extras
				'^/website-extras/': {
					target: `http://${websiteExtrasDevServerHost}:${websiteExtrasDevServerPort}`,
				},
				// Proxy requests to the remote content through this server for dev
				// builds. See base config below.
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
			viteIgnoreImports({
				extensions: ['wasm', 'so', 'dat'],
			}),
			...viteGlobalExtensions,
			buildVersionPlugin('website-config'),
			virtualModule({
				name: 'cors-proxy-url',
				content: `
				export const corsProxyUrl = ${JSON.stringify(corsProxyUrl || undefined)};`,
			}),
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
			 * Generate a list of files needed for the website to function offline.
			 */
			listAssetsRequiredForOfflineMode({
				outputFile: 'assets-required-for-offline-mode.json',
				distDirectoriesToList: ['./', '../remote'],
			}) as Plugin,

			/**
			 * Copy the `builder/index.php` workaround to the `dist/playground/website/builder/` directory.
			 */
			{
				name: 'builder-index-plugin',
				apply: 'build',
				writeBundle({ dir: outputDir }) {
					const indexPath = path('builder/index.php');

					if (existsSync(indexPath) && outputDir) {
						copyFileSync(
							indexPath,
							join(outputDir, 'builder/index.php')
						);
					}
				},
			} as Plugin,
			{
				name: 'inject-commit-id',
				transformIndexHtml(html) {
					try {
						const commitId = require('child_process')
							.execSync('git rev-parse HEAD')
							.toString()
							.trim();
						return html.replace(
							'</head>',
							`<meta name="commit-id" content="${commitId}" />
							</head>`
						);
					} catch (e) {
						// eslint-disable-next-line no-console
						console.error('Failed to inject commit ID', e);
						return html;
					}
				},
			},
		],

		// Configuration for building your library.
		// See: https://vitejs.dev/guide/build.html#library-mode
		build: {
			target: 'esnext',
			sourcemap: true,
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
				output: {
					manualChunks: (id) => {
						// Split CodeMirror and Lezer packages into separate chunks
						// that will be placed in assets/optional/ directory

						// Check for specific language extensions FIRST, before the general @codemirror.
						// We want to package each of them separately so they can be downloaded on demand
						// and not all together.

						// These are lazy-loaded in code-editor.tsx:
						if (id.includes('node_modules/@codemirror/lang-css')) {
							return 'optional/lang-css';
						}
						if (
							id.includes(
								'node_modules/@codemirror/lang-javascript'
							)
						) {
							return 'optional/lang-javascript';
						}
						if (id.includes('node_modules/@codemirror/lang-json')) {
							return 'optional/lang-json';
						}
						if (id.includes('node_modules/@codemirror/lang-html')) {
							return 'optional/lang-html';
						}
						if (
							id.includes(
								'node_modules/@codemirror/lang-markdown'
							)
						) {
							return 'optional/lang-markdown';
						}
						if (id.includes('node_modules/@codemirror/lang-php')) {
							return 'optional/lang-php';
						}

						// General CodeMirror core packages
						if (id.includes('node_modules/@codemirror/')) {
							return 'optional/vendor-codemirror';
						}

						// Lezer parser packages
						if (id.includes('node_modules/@lezer/')) {
							return 'optional/vendor-lezer';
						}

						// Optional, lazy loaded Blueprint Editor package
						if (id.includes('blueprint-editor')) {
							return 'optional/blueprint-editor';
						}
					},
					assetFileNames: (chunkInfo) => {
						// Split Extensions or associated shared files into separate chunks
						// that will be placed in assets/extensions/ directory
						if (
							chunkInfo.names?.[0]?.endsWith('.so') ||
							chunkInfo.names?.[0]?.endsWith('.dat')
						) {
							return 'assets/extensions/[name]-[hash][extname]';
						}

						return 'assets/[name]-[hash][extname]';
					},
				},
				external: [],
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
	};
});
