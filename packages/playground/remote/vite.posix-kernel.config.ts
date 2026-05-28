/**
 * Vite dev-server config for the `--experimental-posix-kernel` browser
 * mode.
 *
 * Sibling of `vite.config.ts` — the original config is kept untouched
 * so `npm run dev` continues to boot the classic Playground unchanged.
 * Invoked exclusively as `vite --config vite.posix-kernel.config.ts`
 * (see `packages/playground/remote/project.json`:`dev-experimental-
 * posix-kernel`). Build / preview / test targets remain owned by
 * `vite.config.ts`, so this file is dev-server-only.
 *
 * Key differences from `vite.config.ts`:
 *   1. A `resolveKernelBinariesPlugin` resolves `@kernel-wasm` and
 *      `@kernel-binary/<rel>?url` imports against a wasm-posix-kernel
 *      checkout (defaults to the bundled `wasm-posix-kernel/` submodule;
 *      override with `WASM_POSIX_KERNEL_DIR` to point elsewhere).
 *   2. `server.fs.allow` is extended to the repo root so the worker
 *      can pull `BrowserKernel`, the nested kernel-worker entry, and
 *      binary assets from the neighbouring submodule.
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

/**
 * Resolve the wasm-posix-kernel checkout. Mirrors the CLI's
 * `host-bridge.ts` precedence: env var wins, falls back to the bundled
 * submodule. Vite needs an absolute path because resolution happens
 * here at config load, before the worker exists.
 */
function resolveKernelDir(): string {
	const env = process.env['WASM_POSIX_KERNEL_DIR'];
	if (env && existsSync(join(env, 'host'))) {
		return env;
	}
	return resolve(__dirname, '../../../wasm-posix-kernel');
}

/**
 * Resolve `@kernel-wasm?url`, `@rootfs-vfs?url`, and
 * `@kernel-binary/<rel>?url` imports against the kernel checkout.
 * Mirrors the alias scheme used by
 * `wasm-posix-kernel/examples/browser/vite.config.ts` so the demo's
 * `BrowserKernel` / `kernel-worker-entry.ts` imports work unchanged
 * when re-exported from `posix-kernel/host-bridge.ts`.
 *
 * Lookup order for `@kernel-wasm` and `@kernel-binary/*`, first hit wins:
 *   1. `<kernelDir>/local-binaries/<rel>` — local `bash build.sh` output.
 *   2. `<kernelDir>/binaries/<rel>` — release-mirrored artifacts.
 *
 * `@rootfs-vfs` resolves to `<kernelDir>/host/wasm/rootfs.vfs` (built by
 * `scripts/build-rootfs.sh` during `bash build.sh`). The kernel-mode
 * `BrowserKernel` imports it unconditionally to overlay `/etc/*` onto
 * the SAB-backed VFS, so a missing file would otherwise surface as a
 * cryptic worker-load failure — we throw with the build hint instead.
 */
function resolveKernelBinariesPlugin(): Plugin {
	const kernelDir = resolveKernelDir();
	const KERNEL_WASM_ALIAS = '@kernel-wasm';
	const ROOTFS_VFS_ALIAS = '@rootfs-vfs';
	const BINARIES_PREFIX = '@kernel-binary/';
	const tryRoots = ['local-binaries', 'binaries'];

	function findUnder(rel: string): string | null {
		for (const root of tryRoots) {
			const candidate = join(kernelDir, root, rel);
			if (existsSync(candidate)) {
				return candidate;
			}
		}
		return null;
	}

	return {
		name: 'wasm-posix-kernel-binaries',
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
			let resolved: string | null = null;
			if (pathPart === KERNEL_WASM_ALIAS) {
				resolved = findUnder('kernel.wasm');
			} else if (pathPart === ROOTFS_VFS_ALIAS) {
				const candidate = join(kernelDir, 'host/wasm/rootfs.vfs');
				if (existsSync(candidate)) {
					resolved = candidate;
				} else {
					this.error(
						`rootfs.vfs not found at ${candidate}. ` +
							'Run `bash build.sh` from the wasm-posix-kernel ' +
							'checkout to produce it.'
					);
				}
			} else if (pathPart.startsWith(BINARIES_PREFIX)) {
				resolved = findUnder(pathPart.slice(BINARIES_PREFIX.length));
			}
			return resolved ? resolved + query : null;
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
		name: 'wasm-posix-kernel-remote-html-alias',
		configureServer(server) {
			server.middlewares.use((req, _res, next) => {
				// The website constructs the iframe URL as
				// `/remote.html?v=<buildVersion>` (see
				// packages/playground/website/src/lib/config.ts:7-8),
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
		name: 'wasm-posix-kernel-client-index-alias',
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

		// Runtime side of the `@wasm-posix-kernel/*` alias whose TS
		// counterpart lives in `src/lib/posix-kernel/wasm-posix-kernel.d.ts`.
		// The shim keeps the submodule out of our strict typecheck; this
		// alias resolves the same specifiers to the actual files.
		resolve: {
			alias: [
				{
					find: /^@wasm-posix-kernel\/(.*)$/,
					replacement: resolve(resolveKernelDir(), '$1'),
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
			// which the kernel worker's `MemoryFileSystem` allocates.
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
				/*
				 * The kernel worker (origin = this remote dev server)
				 * issues outbound HTTPS through its TLS-MITM backend,
				 * which fetches `/cors-proxy?url=<encoded>` relative to
				 * the worker — see
				 * `wasm-posix-kernel/examples/browser/lib/
				 * kernel-worker-entry.ts:299`. The base `/cors-proxy`
				 * proxy here would forward unchanged and `cors-proxy.php`
				 * would 404 that shape; mirror the rewrite from
				 * `packages/playground/website/vite.posix-kernel.config.ts`
				 * so `blueprints.spec.ts:704/822` (HTTPS via
				 * `file_get_contents`) actually reach the proxy.
				 */
				'/cors-proxy': {
					target: 'http://127.0.0.1:5263',
					changeOrigin: true,
					rewrite: (path: string) => {
						const kandeloPrefix = '/cors-proxy?url=';
						if (path.startsWith(kandeloPrefix)) {
							const encoded = path.slice(kandeloPrefix.length);
							return (
								'/cors-proxy.php?' + decodeURIComponent(encoded)
							);
						}
						return path.replace(
							/^\/cors-proxy\/\?/,
							'/cors-proxy.php?'
						);
					},
				},
			},
			fs: {
				// Extend to the repo root so the worker can resolve
				// `wasm-posix-kernel/host/src/**` and
				// `wasm-posix-kernel/examples/browser/lib/**`.
				allow: ['../../../'],
			},
		},

		plugins,

		worker: {
			format: 'es',
			plugins: () => plugins,
		},
	};
});
