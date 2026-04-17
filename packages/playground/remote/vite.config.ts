/// <reference types="vitest" />
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { join } from 'path';
import { fileURLToPath } from 'node:url';
import dts from 'vite-plugin-dts';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { remoteDevServerHost, remoteDevServerPort } from '../build-config';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';
import { copyFileSync, existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { buildVersionPlugin } from '../../vite-extensions/vite-build-version';
// eslint-disable-next-line @nx/enforce-module-boundaries
import virtualModule from '../../vite-extensions/vite-virtual-module';
// eslint-disable-next-line @nx/enforce-module-boundaries
import viteGlobalExtensions from '../../vite-extensions/vite-global-extensions';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { isomorphicGitBrowserAlias } from '../../vite-extensions/vite-resolve-isomorphic-git';

const path = (filename: string) =>
	fileURLToPath(new URL(filename, import.meta.url));

const plugins = [
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
	wordpressOrgFontsPlugin(),
];

/**
 * Fetches the Inter + EB Garamond woff2 files served by wordpress.org
 * (the fonts used across the wp.org site) once, caches them locally,
 * serves them at `/fonts/*` during dev, and copies them into
 * `dist/fonts/` on build. The files are not committed to git; they
 * ship alongside the built assets so the progress overlay matches
 * the wordpress.org visual identity with no third-party runtime
 * dependency. See https://make.wordpress.org/design/ for context.
 */
function wordpressOrgFontsPlugin(): Plugin {
	const fonts = [
		{
			url: 'https://wordpress.org/wp-content/mu-plugins/pub-sync/global-fonts/Inter/Inter-latin.woff2',
			filename: 'Inter-latin.woff2',
		},
		{
			url: 'https://wordpress.org/wp-content/mu-plugins/pub-sync/global-fonts/EB-Garamond/EBGaramond-latin.woff2',
			filename: 'EBGaramond-latin.woff2',
		},
	];
	const cacheDir = path('../../../node_modules/.cache/playground-fonts');

	async function ensureCached() {
		await mkdir(cacheDir, { recursive: true });
		await Promise.all(
			fonts.map(async ({ url, filename }) => {
				const dest = join(cacheDir, filename);
				if (existsSync(dest)) return;
				const res = await fetch(url);
				if (!res.ok) {
					throw new Error(
						`Failed to download font ${url}: ${res.status}`
					);
				}
				await writeFile(dest, Buffer.from(await res.arrayBuffer()));
			})
		);
	}

	return {
		name: 'wordpress-org-fonts-plugin',
		async configureServer(server) {
			const ready = ensureCached();
			server.middlewares.use('/fonts', async (req, res, next) => {
				try {
					await ready;
					const name = (req.url || '')
						.replace(/^\/+/, '')
						.split('?')[0];
					const match = fonts.find((f) => f.filename === name);
					if (!match) return next();
					res.setHeader('Content-Type', 'application/font-woff2');
					res.setHeader(
						'Cache-Control',
						'public, max-age=31536000, immutable'
					);
					res.end(await readFile(join(cacheDir, match.filename)));
				} catch (e) {
					next(e);
				}
			});
		},
		async writeBundle({ dir: outputDir }) {
			if (!outputDir) return;
			await ensureCached();
			await mkdir(join(outputDir, 'fonts'), { recursive: true });
			for (const { filename } of fonts) {
				copyFileSync(
					join(cacheDir, filename),
					join(outputDir, 'fonts', filename)
				);
			}
		},
	};
}

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
			'*.zip',
			'**/*.tar.zst',
		],
		cacheDir: '../../../node_modules/.vite/playground',
		resolve: {
			alias: [isomorphicGitBrowserAlias()],
		},
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
					/**
					 * Keep `wasm-feature-detect` out of worker entry chunks.
					 *
					 * The PHP loader chunks import `jspi` from
					 * `wasm-feature-detect` to choose between JSPI and
					 * Asyncify builds. Rollup may otherwise decide that the
					 * Blueprints worker entry chunk is the cheapest place to
					 * host that shared import. In WebKit, dynamically loading a
					 * PHP loader chunk would then import the worker entrypoint as
					 * a normal module dependency inside the same worker global.
					 * That re-evaluates the entrypoint and tries to expose the
					 * Comlink endpoint a second time.
					 *
					 * A dedicated, side-effect-free chunk makes PHP loader chunks
					 * import `wasm-feature-detect` directly instead of importing
					 * the worker entrypoint.
					 */
					manualChunks(id) {
						if (/[\\/]wasm-feature-detect[\\/]/.test(id)) {
							return 'wasm-feature-detect';
						}
						return undefined;
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
