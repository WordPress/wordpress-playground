/// <reference types="vitest" />
/**
 * Vite config for the website server in
 * `npm run dev:experimental-posix-kernel` mode.
 *
 * Sibling of `vite.config.ts` — the original is kept untouched so
 * `npm run dev` continues to boot the classic Playground unchanged.
 * This wrapper imports the base config function, invokes it with the
 * same Vite env, and overlays the headers required to make the
 * iframe at `/remote.html?v=...` cross-origin isolated.
 *
 * ## Why this wrapper exists
 *
 * The kernel worker (`packages/playground/remote/src/lib/posix-kernel/
 * playground-worker-endpoint.ts`) builds the VFS image in a
 * `SharedArrayBuffer`. SAB is only available in cross-origin
 * isolated documents. For an embedded iframe to be COI'd, the spec
 * requires *both* the iframe response AND the parent (this website)
 * to set `Cross-Origin-Embedder-Policy`. The kernel-mode remote
 * already sets COEP on every response (see
 * `packages/playground/remote/vite.posix-kernel.config.ts`); this
 * wrapper adds the matching pair on the website server so the
 * embedder opts in too.
 *
 * Why `credentialless` instead of `require-corp`: the website at
 * `:5400` loads cross-origin sub-resources (analytics, Octokit, etc.)
 * that don't send `Cross-Origin-Resource-Policy`. `require-corp`
 * would block them; `credentialless` strips credentials from no-CORS
 * cross-origin fetches and lets them through. Both COEP variants
 * enable cross-origin isolation.
 *
 * Document-Isolation-Policy would have been preferable (no embedder
 * opt-in needed), but it is not currently active by default in
 * stable Chrome — verified with Chrome 148, which doesn't even
 * expose the `chrome://flags/#document-isolation-policy` toggle.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defineConfig } from 'vite';
import type {
	ConfigEnv,
	Plugin,
	UserConfig,
	UserConfigExport,
	ViteDevServer,
} from 'vite';
// eslint-disable-next-line @nx/enforce-module-boundaries
import baseConfigExport from './vite.config';
import {
	PREINSTALLED_DB_CACHE_DIR,
	PREINSTALLED_DB_FILENAME,
	PREINSTALLED_DB_URL_PATH,
	PREINSTALLED_VFS_FILENAME,
	PREINSTALLED_VFS_URL_PATH,
} from './playwright/e2e/posix-kernel/fixtures/preinstalled-db';

// This config lives in the website package root; Vite defines `__dirname`
// to that directory when it bundles the config. The Playwright globalSetup
// resolves the same file from its own `playwright/` location.
const PREINSTALLED_DB_FILE = join(
	__dirname,
	'playwright',
	PREINSTALLED_DB_CACHE_DIR,
	PREINSTALLED_DB_FILENAME
);

const PREINSTALLED_VFS_FILE = join(
	__dirname,
	'playwright',
	PREINSTALLED_DB_CACHE_DIR,
	PREINSTALLED_VFS_FILENAME
);

/**
 * Serve one of the e2e "boot-once" snapshots the Playwright globalSetup
 * captures (the SQLite DB and the full VFS image). Read lazily on each
 * request so the dev server (which the Playwright `webServer` may start
 * before — or reuse across — globalSetup) always returns whatever bytes are
 * on disk right now. A missing file is a plain 404, which the kernel worker
 * treats as non-fatal and falls back to the full build + installer.
 */
function servePreinstalledSnapshotPlugin(
	name: string,
	urlPath: string,
	filePath: string
): Plugin {
	return {
		name,
		configureServer(server: ViteDevServer) {
			server.middlewares.use(urlPath, (_req, res) => {
				readFile(filePath).then(
					(buffer) => {
						res.setHeader(
							'Content-Type',
							'application/octet-stream'
						);
						res.end(buffer);
					},
					() => {
						res.statusCode = 404;
						res.end();
					}
				);
			});
		},
	};
}

export default defineConfig(async (env: ConfigEnv): Promise<UserConfig> => {
	const baseConfig = baseConfigExport as UserConfigExport;
	const resolved =
		typeof baseConfig === 'function'
			? await baseConfig(env)
			: await baseConfig;
	return {
		...resolved,
		plugins: [
			...(resolved.plugins ?? []),
			servePreinstalledSnapshotPlugin(
				'posix-kernel-preinstalled-db',
				PREINSTALLED_DB_URL_PATH,
				PREINSTALLED_DB_FILE
			),
			servePreinstalledSnapshotPlugin(
				'posix-kernel-preinstalled-vfs',
				PREINSTALLED_VFS_URL_PATH,
				PREINSTALLED_VFS_FILE
			),
		],
		server: {
			...resolved.server,
			headers: {
				...(resolved.server?.headers ?? {}),
				'Cross-Origin-Opener-Policy': 'same-origin',
				'Cross-Origin-Embedder-Policy': 'credentialless',
			},
			proxy: {
				...(resolved.server?.proxy ?? {}),
				/*
				 * Override the base `/cors-proxy` rule to also accept the
				 * kernel worker's hardcoded dev shape
				 * (`/cors-proxy?url=<encoded>`, baked into
				 * `kandelo/examples/browser/lib/
				 * kernel-worker-entry.ts:299`). Without this, every
				 * outbound HTTPS request from kernel-resident PHP
				 * (file_get_contents, etc.) returns 404 from
				 * `cors-proxy.php`, which makes
				 * `blueprints.spec.ts:704/746/822` fail.
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
		},
	};
});
