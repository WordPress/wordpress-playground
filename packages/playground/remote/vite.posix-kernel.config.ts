/// <reference types="vitest" />
/**
 * Vite config for the `--experimental-posix-kernel` browser mode.
 *
 * Sibling of `vite.config.ts`, which keeps serving the classic
 * Playground for `npm run dev`. Serves three targets (see
 * `packages/playground/remote/project.json`): the
 * `dev-experimental-posix-kernel` dev server, the
 * `build-experimental-posix-kernel` production build, and the
 * `test-remote-posix-kernel` vitest run for the posix-kernel unit
 * specs, which `vite.config.ts` excludes from its generic test target.
 * The preview target remains owned by `vite.config.ts`.
 *
 * The build writes to `dist/packages/playground/remote-posix-kernel`, so
 * the classic and kernel asset graphs never overwrite each other. It needs
 * the `kandelo/` submodule, so it is not part of the website build graph:
 * `deploy-website.yml` runs the target, and `build:wasm-wordpress-net`
 * copies its output only when present.
 *
 * Key differences from `vite.config.ts`:
 *   1. A `resolveKernelBinariesPlugin` resolves `@kernel-wasm` and
 *      `@kernel-binary/<rel>?url` imports against the kandelo build
 *      committed in `@wp-playground/posix-kernel-builds`.
 *   2. `server.fs.allow` is extended to the repo root so the worker
 *      can import `BrowserKernel` and the other host modules from the
 *      `kandelo/` submodule, and the binaries from
 *      `posix-kernel-builds`.
 *   3. A small dev-server middleware aliases `/remote.html` to the
 *      kernel-mode HTML entry so the unchanged website-side iframe URL
 *      (`/remote.html?v=<buildVersion>`) keeps working.
 *   4. Cross-origin isolation headers (COEP / COOP / DIP) are set on
 *      every response so the kernel worker can allocate
 *      `SharedArrayBuffer`.
 */
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { remoteDevServerHost, remoteDevServerPort } from '../build-config';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { buildVersionPlugin } from '../../vite-extensions/vite-build-version';
// eslint-disable-next-line @nx/enforce-module-boundaries
import virtualModule from '../../vite-extensions/vite-virtual-module';

const kandeloDir = resolve(__dirname, '../../../kandelo');

/**
 * Resolve `@kernel-wasm?url`, `@rootfs-vfs?url`, and
 * `@kernel-binary/<rel>?url` imports against the kandelo build committed in
 * `@wp-playground/posix-kernel-builds`. The kandelo host source imports the
 * first two; `vfs-builder.ts` imports the programs through the third.
 */
function resolveKernelBinariesPlugin(): Plugin {
	const binariesDir = resolve(
		__dirname,
		'../posix-kernel-builds/local-binaries/source-only-v1'
	);
	const aliases: Record<string, string> = {
		'@kernel-wasm': 'kernel.wasm',
		'@rootfs-vfs': 'programs/wasm32/rootfs.vfs.zst',
	};
	const BINARIES_PREFIX = '@kernel-binary/';

	return {
		name: 'kandelo-binaries',
		enforce: 'pre',
		resolveId(source) {
			// Vite passes the suffix (`?url`, `?worker&url`, …) through
			// to `resolveId`. Strip it before matching the alias, then
			// re-append so downstream plugins (notably `?url`) still see
			// the query and emit an asset URL rather than ESM bindings.
			const queryIdx = source.indexOf('?');
			const pathPart =
				queryIdx === -1 ? source : source.slice(0, queryIdx);
			const query = queryIdx === -1 ? '' : source.slice(queryIdx);
			const rel = pathPart.startsWith(BINARIES_PREFIX)
				? pathPart.slice(BINARIES_PREFIX.length)
				: aliases[pathPart];
			if (rel === undefined) {
				return null;
			}
			const resolved = join(binariesDir, rel);
			if (!existsSync(resolved)) {
				this.error(
					`${resolved} not found. Add it to ` +
						'packages/playground/posix-kernel-builds/scripts/build.sh ' +
						'and run `npx nx bundle-kandelo playground-posix-kernel-builds`.'
				);
			}
			return resolved + query;
		},
	};
}

/**
 * Serve `remote-posix-kernel.html` at `/remote.html` in dev so the
 * unchanged website-side iframe loads the kernel-mode entry without
 * any client-side flag plumbing.
 */
function aliasRemoteHtmlPlugin(): Plugin {
	return {
		name: 'kandelo-remote-html-alias',
		configureServer(server) {
			server.middlewares.use((req, _res, next) => {
				// The website constructs the iframe URL as
				// `/remote.html?v=<buildVersion>` (see
				// packages/playground/website/src/lib/config.ts),
				// so the request reaches us with a query string. Match
				// on the pathname only and preserve the query so Vite's
				// HMR cache-bust keeps working.
				const raw = req.url || '';
				const queryIdx = raw.indexOf('?');
				const pathname = queryIdx === -1 ? raw : raw.slice(0, queryIdx);
				if (pathname === '/remote.html') {
					const query = queryIdx === -1 ? '' : raw.slice(queryIdx);
					req.url = '/remote-posix-kernel.html' + query;
				}
				next();
			});
		},
	};
}

/**
 * Serve the `@wp-playground/client` source at `/client/index.js` so
 * `<php-snippet>` embeds load it without a built `dist/client/`.
 */
function aliasClientIndexPlugin(): Plugin {
	const clientIndex = resolve(__dirname, '../client/src/index.ts');
	return {
		name: 'kandelo-client-index-alias',
		configureServer(server) {
			server.middlewares.use((req, _res, next) => {
				const raw = req.url || '';
				const queryIdx = raw.indexOf('?');
				const pathname = queryIdx === -1 ? raw : raw.slice(0, queryIdx);
				if (pathname === '/client/index.js') {
					const query = queryIdx === -1 ? '' : raw.slice(queryIdx);
					req.url = '/@fs' + clientIndex + query;
				}
				next();
			});
		},
	};
}

/**
 * Same output rule as `vite.config.ts`: extension modules (`.so`) and
 * their data files (`.dat`) land in `assets/extensions/`.
 */
function extensionAwareAssetFileNames(chunkInfo: { names?: string[] }) {
	if (
		chunkInfo.names?.[0]?.endsWith('.so') ||
		chunkInfo.names?.[0]?.endsWith('.dat')
	) {
		return 'assets/extensions/[name]-[hash][extname]';
	}
	return 'assets/[name]-[hash][extname]';
}

const plugins = [
	viteTsConfigPaths({
		root: '../../../',
	}),
	resolveKernelBinariesPlugin(),
	aliasRemoteHtmlPlugin(),
	aliasClientIndexPlugin(),
	buildVersionPlugin('remote-config'),
];

export default defineConfig(() => {
	/**
	 * The dev-mode classic config uses `/cors-proxy/?` which the SW's
	 * `shouldCacheUrl` matches and tries to put through `cacheFirstFetch`.
	 * Chrome's CacheStorage truncates the 28 MiB WordPress core zip
	 * around 19 MiB, producing a `Compressed input was truncated` deep
	 * inside the zip decoder. `shouldCacheUrl` returns false for URL
	 * pathnames ending with `.php`, so route directly to
	 * `/cors-proxy.php?` — Vite's `/cors-proxy` proxy forwards it because
	 * the prefix matches.
	 */
	const corsProxyUrl =
		'CORS_PROXY_URL' in process.env
			? process.env['CORS_PROXY_URL']
			: '/cors-proxy.php?';

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
		cacheDir: '../../../node_modules/.vite/playground-posix-kernel',
		publicDir: new URL('../wordpress-builds/public', import.meta.url)
			.pathname,

		// Pre-bundle every dependency the kernel iframe pulls in at boot.
		// `zstddec/stream`, `octokit`, and `@zip.js/zip.js` are only reached
		// via dynamic imports during WordPress boot, so a cold dev server
		// misses them in its initial crawl and re-optimizes mid-run — which
		// rewrites the shared deps chunk's hash and 404s every page load
		// already in flight (empty `#wp` iframe). Listing them here forces a
		// complete optimize at startup so the server never re-optimizes while
		// the e2e suite is running. See playwright.posix-kernel.config.ts.
		optimizeDeps: {
			include: [
				'events',
				'ini',
				'wasm-feature-detect',
				'zstddec/stream',
				'octokit',
				'@zip.js/zip.js',
			],
		},

		// Runtime side of the `@kandelo/*` alias whose TS
		// counterpart lives in `src/lib/posix-kernel/kandelo.d.ts`.
		// The shim keeps the submodule out of our strict typecheck; this
		// alias resolves the same specifiers to the actual files.
		resolve: {
			alias: [
				{
					find: /^@kandelo\/(.*)$/,
					replacement: resolve(kandeloDir, '$1'),
				},
			],
		},

		css: {
			modules: {
				localsConvention: 'camelCaseOnly',
			},
		},

		server: {
			port: remoteDevServerPort,
			host: remoteDevServerHost,
			allowedHosts: ['playground.test', 'playground-preview.test'],
			// Cross-origin isolation is required for `SharedArrayBuffer`,
			// which backs the kernel's VFS.
			// COEP `require-corp` + COOP `same-origin` on the iframe
			// pair with COEP `credentialless` + COOP `same-origin` on
			// the parent (see `packages/playground/website/
			// vite.posix-kernel.config.ts`). `Document-Isolation-Policy`
			// is preserved by the service worker
			// (`service-worker.ts:applyCrossOriginIsolationHeaders`) on
			// Chrome 137+ as the modern path. `Service-Worker-Allowed:
			// /` widens SW scope so the classic playground service
			// worker (registered from the kernel-mode iframe) controls
			// the full origin.
			headers: {
				'Cross-Origin-Opener-Policy': 'same-origin',
				'Cross-Origin-Embedder-Policy': 'require-corp',
				'Document-Isolation-Policy': 'isolate-and-require-corp',
				'Service-Worker-Allowed': '/',
			},
			proxy: {
				'/cors-proxy': {
					target: 'http://127.0.0.1:5263',
					changeOrigin: true,
					rewrite: (path: string) =>
						path.replace(/^\/cors-proxy\/\?/, '/cors-proxy.php?'),
				},
			},
			fs: {
				// Extend to the repo root so the worker can resolve
				// `kandelo/host/src/**`, `kandelo/apps/browser-demos/lib/**`,
				// and the `posix-kernel-builds` binaries.
				allow: ['../../../'],
			},
		},

		plugins,

		worker: {
			format: 'es',
			plugins: () => plugins,
			/**
			 * Mirrors `vite.config.ts`. The stable `sw.js` name matters
			 * doubly here: the posix-kernel boot registers the same
			 * `service-worker.ts` as the classic remote, and the website
			 * artifact ships the classic-built copy — both builds must
			 * resolve the registration URL to the same `/sw.js`.
			 */
			rollupOptions: {
				output: {
					assetFileNames: extensionAwareAssetFileNames,
					chunkFileNames: (chunkInfo: any) => {
						if (
							chunkInfo.facadeModuleId?.endsWith('.so') ||
							chunkInfo.facadeModuleId?.endsWith('.dat')
						) {
							return 'assets/extensions/[name]-[hash].js';
						}
						return 'assets/[name]-[hash].js';
					},
					// See the `manualChunks` comment in `vite.config.ts` —
					// keeps `wasm-feature-detect` out of worker entry chunks.
					manualChunks(id) {
						if (/[\\/]wasm-feature-detect[\\/]/.test(id)) {
							return 'wasm-feature-detect';
						}
						return undefined;
					},
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
			// See vite.config.ts — assets must be real files, not inlined.
			assetsInlineLimit: 0,
			sourcemap: true,
			outDir: '../../../dist/packages/playground/remote-posix-kernel',
			emptyOutDir: true,
			// The classic build already ships the `wordpress-builds`
			// public assets into the website artifact; do not copy the
			// same files a second time.
			copyPublicDir: false,
			rollupOptions: {
				input: {
					'remote-posix-kernel': resolve(
						__dirname,
						'remote-posix-kernel.html'
					),
				},
				output: {
					assetFileNames: extensionAwareAssetFileNames,
				},
			},
		},

		test: {
			// The posix-kernel specs need the `@kandelo/*` alias above.
			// `vite.config.ts` excludes them from the generic test target
			// and they run exclusively here.
			include: [
				'src/lib/posix-kernel/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
			],
		},
	};
});
