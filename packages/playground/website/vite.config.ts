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
import {
	copyFileSync,
	existsSync,
	readFileSync,
	readdirSync,
	statSync,
} from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { exec } from 'node:child_process';
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
			// Serve the built @wp-playground/client library at /client/
			// to match production where playground.wordpress.net/client/index.js
			// is available. Auto-builds if missing, warns if stale.
			{
				name: 'serve-client-library',
				configureServer(server: ViteDevServer) {
					const repoRoot = join(__dirname, '../../../');
					const clientDistDir = join(
						repoRoot,
						'dist/packages/playground/client'
					);
					const clientSrcDir = join(__dirname, '../client/src');
					let buildInProgress = false;
					let stalenessChecked = false;
					let sourcesDirty = false;

					function newestMtimeIn(dir: string): number {
						let newest = 0;
						try {
							for (const entry of readdirSync(dir, {
								withFileTypes: true,
							})) {
								const full = join(dir, entry.name);
								if (entry.isDirectory()) {
									newest = Math.max(
										newest,
										newestMtimeIn(full)
									);
								} else if (entry.isFile()) {
									newest = Math.max(
										newest,
										statSync(full).mtimeMs
									);
								}
							}
						} catch {
							// Directory may not exist yet
						}
						return newest;
					}

					function triggerClientBuild() {
						if (buildInProgress) {
							return;
						}
						buildInProgress = true;
						server.config.logger.warn(
							'\n  Building @wp-playground/client… Refresh when done.\n'
						);
						exec(
							'npx nx build playground-client',
							{ cwd: repoRoot },
							(error, stdout, stderr) => {
								buildInProgress = false;
								stalenessChecked = true;
								sourcesDirty = false;
								if (error) {
									server.config.logger.error(
										'  @wp-playground/client build failed. ' +
											'Run manually: npx nx build playground-client\n'
									);
									if (stderr) {
										server.config.logger.error(stderr);
									}
								} else {
									server.config.logger.info(
										'  @wp-playground/client built. Refresh to load.\n'
									);
								}
							}
						);
					}

					server.watcher.add(clientSrcDir);
					server.watcher.on('change', (changedPath) => {
						if (changedPath.startsWith(clientSrcDir)) {
							sourcesDirty = true;
							stalenessChecked = false;
						}
					});

					server.middlewares.use((req, res, next) => {
						if (!req.url?.startsWith('/client/')) {
							return next();
						}

						const distIndexPath = join(clientDistDir, 'index.js');

						if (!existsSync(distIndexPath)) {
							triggerClientBuild();
							res.setHeader('Access-Control-Allow-Origin', '*');
							res.setHeader(
								'Content-Type',
								'application/javascript'
							);
							res.statusCode = 503;
							res.end(
								'throw new Error(' +
									'"@wp-playground/client is not built yet. ' +
									'A build was triggered automatically — refresh in a few seconds.\\n' +
									'Or build manually: npx nx build playground-client"' +
									');'
							);
							return;
						}

						if (
							!stalenessChecked &&
							!buildInProgress
						) {
							stalenessChecked = true;
							const distMtime =
								statSync(distIndexPath).mtimeMs;
							const srcMtime = newestMtimeIn(clientSrcDir);
							if (srcMtime > distMtime) {
								sourcesDirty = true;
							}
						}
						if (sourcesDirty && !buildInProgress) {
							sourcesDirty = false;
							triggerClientBuild();
						}

						let urlPath: string;
						try {
							urlPath = new URL(req.url, 'http://localhost')
								.pathname;
						} catch {
							res.statusCode = 400;
							res.end('Invalid request URL');
							return;
						}
						const filePath = resolve(
							clientDistDir,
							urlPath.slice('/client/'.length)
						);
						const rel = relative(clientDistDir, filePath);
						if (rel.startsWith('..') || isAbsolute(rel)) {
							res.statusCode = 403;
							res.end();
							return;
						}
						if (!existsSync(filePath)) {
							return next();
						}
						const contentTypes: Record<string, string> = {
							'.js': 'application/javascript',
							'.cjs': 'application/javascript',
							'.json': 'application/json',
							'.map': 'application/json',
						};
						const ext = Object.keys(contentTypes).find((e) =>
							filePath.endsWith(e)
						);
						res.setHeader('Access-Control-Allow-Origin', '*');
						res.setHeader(
							'Content-Type',
							ext ? contentTypes[ext] : 'application/octet-stream'
						);
						res.end(readFileSync(filePath));
					});
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
