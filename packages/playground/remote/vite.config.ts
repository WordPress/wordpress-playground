/// <reference types="vitest" />
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { join } from 'path';
import dts from 'vite-plugin-dts';
import { build as esbuildBuild } from 'esbuild';
import { execSync } from 'child_process';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { remoteDevServerHost, remoteDevServerPort } from '../build-config';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';
import { copyFileSync, existsSync, readFileSync } from 'fs';
import { relative } from 'path';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { buildVersionPlugin } from '../../vite-extensions/vite-build-version';
// eslint-disable-next-line @nx/enforce-module-boundaries
import virtualModule from '../../vite-extensions/vite-virtual-module';
// eslint-disable-next-line @nx/enforce-module-boundaries
import viteGlobalExtensions from '../../vite-extensions/vite-global-extensions';

const path = (filename: string) => new URL(filename, import.meta.url).pathname;

/**
 * esbuild plugin that resolves Vite-specific imports for
 * on-the-fly bundling of worker files in Firefox dev mode.
 *
 * Handles: virtual modules, ?raw text imports, ?url and
 * binary asset imports (.wasm, .so, .dat, .zip, .phar).
 */
function firefoxBundlePlugin(
	repoRoot: string,
	buildVersion: string
): import('esbuild').Plugin {
	// Asset extensions that Vite handles as URL imports.
	const assetExtensions = ['.wasm', '.so', '.dat', '.zip', '.phar'];

	return {
		name: 'firefox-bundle-vite-compat',
		setup(build) {
			// ── virtual:* modules ──
			build.onResolve({ filter: /^virtual:/ }, (args) => ({
				path: args.path,
				namespace: 'virtual',
			}));
			build.onLoad({ filter: /.*/, namespace: 'virtual' }, (args) => {
				if (args.path === 'virtual:remote-config') {
					return {
						contents: `export const buildVersion = ${JSON.stringify(buildVersion)};`,
						loader: 'js',
					};
				}
				if (args.path === 'virtual:cors-proxy-url') {
					return {
						contents: `export const corsProxyUrl = '/cors-proxy/?';`,
						loader: 'js',
					};
				}
				return { contents: '', loader: 'js' };
			});

			// ── ?raw text imports ──
			build.onResolve({ filter: /\?raw$/ }, (args) => ({
				path: join(args.resolveDir, args.path.replace(/\?raw$/, '')),
				namespace: 'raw',
			}));
			build.onLoad({ filter: /.*/, namespace: 'raw' }, (args) => ({
				contents: readFileSync(args.path, 'utf-8'),
				loader: 'text',
			}));

			// ── ?base64 imports ──
			build.onResolve({ filter: /\?base64$/ }, (args) => ({
				path: join(args.resolveDir, args.path.replace(/\?base64$/, '')),
				namespace: 'base64-asset',
			}));
			build.onLoad(
				{ filter: /.*/, namespace: 'base64-asset' },
				(args) => {
					const data = readFileSync(args.path);
					return {
						contents: `export default ${JSON.stringify(data.toString('base64'))};`,
						loader: 'js',
					};
				}
			);

			// ── ?url asset imports ──
			build.onResolve({ filter: /\?url$/ }, (args) => ({
				path: join(args.resolveDir, args.path.replace(/\?url$/, '')),
				namespace: 'url-asset',
			}));
			build.onLoad({ filter: /.*/, namespace: 'url-asset' }, (args) => {
				// Use Vite's /@fs/ prefix so the dev server
				// can serve files outside the project root.
				const fsUrl = '/@fs/' + args.path;
				return {
					contents: `export default ${JSON.stringify(fsUrl)};`,
					loader: 'js',
				};
			});

			// ── Binary asset imports (.wasm, .so, etc.) ──
			// Vite returns a URL for these; we do the same.
			for (const ext of assetExtensions) {
				const escapedExt = ext.replace('.', '\\.');
				build.onResolve(
					{ filter: new RegExp(`${escapedExt}$`) },
					(args) => {
						// Skip if it has a special suffix (?raw,
						// ?url) — those are handled above.
						if (/\?(raw|url)$/.test(args.path)) {
							return undefined;
						}
						return {
							path: join(args.resolveDir, args.path),
							namespace: 'url-asset',
						};
					}
				);
			}
		},
	};
}

const plugins = [
	/**
	 * Bundles worker files into single files in dev mode for Firefox.
	 *
	 * Firefox cannot use `import` statements in service workers
	 * (Bug 1360870). It also fails to resolve module Worker imports
	 * through a Service Worker fetch handler when COEP is active.
	 * In production, Vite/Rollup bundles everything into single
	 * files. This plugin uses esbuild to do the same on-the-fly
	 * so Firefox works during development.
	 */
	{
		name: 'bundle-workers-firefox-dev',
		apply: 'serve',
		configureServer(server: import('vite').ViteDevServer) {
			server.middlewares.use(async (req, res, next) => {
				const url = req.url ?? '';
				const ua = req.headers['user-agent'] ?? '';
				const isFirefox =
					ua.includes('Firefox') && !ua.includes('Seamonkey');
				if (
					!isFirefox ||
					!url.includes('worker_file') ||
					url.includes('web-service-worker')
				) {
					return next();
				}

				// Extract the file path from the URL (strip query)
				const urlPath = url.split('?')[0];
				const entryPoint = path(`.${urlPath}`);

				try {
					let buildVersion: string;
					try {
						buildVersion = execSync('git rev-parse HEAD')
							.toString()
							.trim();
					} catch {
						buildVersion = String(
							(new Date().getTime() / 1000).toFixed(0)
						);
					}
					const repoRoot = path('../../../');
					const result = await esbuildBuild({
						absWorkingDir: repoRoot,
						entryPoints: [entryPoint],
						bundle: true,
						write: false,
						format: 'esm',
						target: 'esnext',
						tsconfig: join(repoRoot, 'tsconfig.base.json'),
						// Node.js built-in used behind a
						// conditional check; keep it as a
						// dynamic import in the output.
						external: [
							'worker_threads',
							'fs',
							'path',
							'node:fs/promises',
						],
						plugins: [firefoxBundlePlugin(repoRoot, buildVersion)],
						// Suppress known-harmless warnings from
						// Emscripten-generated PHP code and
						// isomorphic-git.
						logLevel: 'error',
					});

					res.setHeader('Content-Type', 'text/javascript');
					res.setHeader(
						'Cross-Origin-Resource-Policy',
						'same-origin'
					);
					res.end(result.outputFiles[0].text);
				} catch (err) {
					// eslint-disable-next-line no-console
					console.error(
						`Failed to bundle ${urlPath} for Firefox:`,
						err
					);
					next();
				}
			});
		},
	} as Plugin,
	/**
	 * Injects CORP headers on all dev-server responses.
	 *
	 * CORP is needed so that once the Service Worker enables
	 * cross-origin isolation (COEP require-corp) after its
	 * reload cycle, sub-resources served directly by Vite
	 * (JS modules, WASM, etc.) are allowed through.
	 *
	 * COEP/COOP are NOT set here — the SW injects them on
	 * its own responses after the page tells it to enable
	 * cross-origin isolation (matching production behavior).
	 */
	{
		name: 'cross-origin-isolation',
		configureServer(server: import('vite').ViteDevServer) {
			server.middlewares.use((_req, res, next) => {
				const origWriteHead = res.writeHead.bind(res);
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				res.writeHead = (...args: any[]) => {
					res.setHeader(
						'Cross-Origin-Resource-Policy',
						'same-origin'
					);
					return origWriteHead(...args);
				};
				next();
			});
		},
	} as Plugin,
	viteTsConfigPaths({
		root: '../../../',
	}),
	dts({
		entryRoot: 'src',
		tsconfigPath: join(__dirname, 'tsconfig.lib.json'),
		pathsToAliases: false,
	}),
	/**
	 * Copy the `.htaccess` file to the `dist` directory.
	 */
	{
		name: 'htaccess-plugin',
		apply: 'build',
		writeBundle({ dir: outputDir }) {
			const htaccessPath = path('.htaccess');

			if (existsSync(htaccessPath) && outputDir) {
				copyFileSync(htaccessPath, join(outputDir, '.htaccess'));
			}
		},
	} as Plugin,
	...viteGlobalExtensions,
	buildVersionPlugin('remote-config'),
];

export default defineConfig(({ mode }) => {
	const corsProxyUrl =
		'CORS_PROXY_URL' in process.env
			? process.env['CORS_PROXY_URL']
			: mode === 'production'
				? 'https://wordpress-playground-cors-proxy.net/?'
				: '/cors-proxy/?';

	plugins.push(
		virtualModule({
			name: 'cors-proxy-url',
			content: `
			export const corsProxyUrl = ${JSON.stringify(corsProxyUrl || undefined)};`,
		})
	);

	return {
		root: __dirname,
		assetsInclude: [
			'**/*.wasm',
			'**/*.so',
			'**/*.dat',
			'**/*.phar',
			'*.zip',
		],
		cacheDir: '../../../node_modules/.vite/playground',
		// Bundled WordPress files live in a separate dependency-free `wordpress`
		// package so that every package may use them without causing circular
		// dependencies.
		// Other than that, the `remote` package has no public assets of its own.
		// Therefore, let's just point the `remote` public directory to the
		// `wordpress` package to make WordPress assets available.
		publicDir: path('../wordpress-builds/public'),

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
			allowedHosts: ['playground.test', 'playground-preview.test'],
			proxy: {
				// Proxy CORS requests to the local PHP CORS proxy server.
				// This avoids Private Network Access (PNA) restrictions in Chrome
				// when making cross-origin requests between different local ports.
				'/cors-proxy': {
					target: 'http://127.0.0.1:5263',
					changeOrigin: true,
					rewrite: (path) =>
						path.replace(/^\/cors-proxy\/\?/, '/cors-proxy.php?'),
				},
			},
			fs: {
				// Allow serving files from the 'packages' directory
				allow: ['../../'],
			},
		},

		plugins,

		worker: {
			format: 'es',
			plugins: () => plugins,
			rollupOptions: {
				output: {
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
					chunkFileNames: (chunkInfo: any) => {
						// Split Extensions or associated shared files into separate chunks
						// that will be placed in assets/extensions/ directory
						if (
							chunkInfo.facadeModuleId?.endsWith('.so') ||
							chunkInfo.facadeModuleId?.endsWith('.dat')
						) {
							return 'assets/extensions/[name]-[hash].js';
						}
						return 'assets/[name]-[hash].js';
					},
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

		build: {
			target: 'esnext',
			// Important: Vite does not extract static assets as separate files
			//            in the library mode. assetsInlineLimit: 0 only works
			//            in the app mode.
			// @see https://github.com/vitejs/vite/issues/3295
			assetsInlineLimit: 0,
			sourcemap: true,
			rollupOptions: {
				input: {
					wordpress: path('/remote.html'),
				},
				output: {
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
			},
			// Clean the output directory to make sure we include only the
			// latest WordPress builds.
			emptyOutDir: true,
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
