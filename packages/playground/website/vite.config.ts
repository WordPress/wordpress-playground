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
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
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
import { analyticsInjectionPlugin } from './vite-analytics-plugin';

const exec = promisify(execCb);

// Determine if we are running in a devcontainer.
const isDevcontainer = process.env.VITE_DEVCONTAINER === 'true';

// In a devcontainer, bind to 0.0.0.0 so the host can access the server through
// a port that was published using the devcontainer "appPort" configuration.
const serverHost = isDevcontainer ? '0.0.0.0' : websiteDevServerHost;

async function setCodespacesPortPublic(port: number, codespaceName: string) {
	// eslint-disable-next-line no-console
	console.log(`Publishing port ${port}...`);
	const cmd = `gh codespace ports visibility ${port}:public -c ${codespaceName}`;
	for (let i = 0; i < 10; i++) {
		try {
			await exec(cmd);
			return;
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}
	}
}

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
			host: serverHost,
			proxy,
		},

		server: {
			port: websiteDevServerPort,
			host: serverHost,
			allowedHosts: [
				'playground.test',
				'playground-preview.test',
				// Allow Codespaces forwarded port hosts.
				...(process.env['CODESPACE_NAME'] ? ['.app.github.dev'] : []),
			],
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
					changeOrigin: true,
				},
				// Proxy requests to the remote content through this server for dev
				// builds. See base config below.
				'^[/]((?!website-server|php-next).)': {
					target: `http://${remoteDevServerHost}:${remoteDevServerPort}`,
					changeOrigin: true,
				},
			},
			fs: {
				strict: false, // Serve files from the other project directories.
			},
		},
		plugins: [
			// In a devcontainer, Vite prints container IP instead of host IP.
			// Override the printed URL to show host IP instead (127.0.0.1).
			isDevcontainer
				? {
						name: 'devcontainer-print-urls',
						configureServer(server: ViteDevServer) {
							const codespaceName = process.env['CODESPACE_NAME'];
							const codespacesDomain =
								process.env[
									'GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN'
								];
							server.printUrls = () => {
								const url =
									codespacesDomain && codespaceName
										? `https://${codespaceName}-${websiteDevServerPort}.${codespacesDomain}/website-server/`
										: `http://127.0.0.1:${websiteDevServerPort}/website-server/`;
								server.config.logger.info(
									`  \x1b[32m➜\x1b[0m  \x1b[1mLocal:\x1b[0m   \x1b[36m${url}\x1b[0m`
								);
							};

							// Codespaces ports default to private, breaking CORS.
							// Publish once the tunnel is ready.
							if (codespaceName) {
								server.httpServer?.once('listening', () =>
									setCodespacesPortPublic(
										websiteDevServerPort,
										codespaceName
									)
								);
							}
						},
					}
				: null,
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
					// Let static playground pages import the local client package in dev.
					server.middlewares.use(
						'/website-server/client/index.js',
						(_, res) => {
							const clientIndexPath = fileURLToPath(
								new URL(
									'../client/src/index.ts',
									import.meta.url
								)
							);
							res.setHeader(
								'Content-Type',
								'application/javascript'
							);
							res.end(
								`export * from ${JSON.stringify(
									`/@fs/${clientIndexPath}`
								)};`
							);
						}
					);
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
			analyticsInjectionPlugin(),
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
