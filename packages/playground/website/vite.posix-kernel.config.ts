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
import { defineConfig } from 'vite';
import type { ConfigEnv, UserConfig, UserConfigExport } from 'vite';
// eslint-disable-next-line @nx/enforce-module-boundaries
import baseConfigExport from './vite.config';

export default defineConfig(async (env: ConfigEnv): Promise<UserConfig> => {
	const baseConfig = baseConfigExport as UserConfigExport;
	const resolved =
		typeof baseConfig === 'function'
			? await baseConfig(env)
			: await baseConfig;
	return {
		...resolved,
		server: {
			...resolved.server,
			headers: {
				...(resolved.server?.headers ?? {}),
				'Cross-Origin-Opener-Policy': 'same-origin',
				'Cross-Origin-Embedder-Policy': 'credentialless',
			},
		},
	};
});
