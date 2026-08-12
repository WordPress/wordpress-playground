// Provided by vite
import { buildVersion } from 'virtual:website-config';
import { logger } from '@php-wasm/logger';
export { buildVersion } from 'virtual:website-config';

/**
 * Whether this session runs the experimental kandelo POSIX-kernel
 * runtime instead of the classic PHP worker. Opted into via
 * `?experimental=kandelo`.
 *
 * The kernel remote needs `SharedArrayBuffer`, which browsers only
 * enable on cross-origin isolated pages. The COOP/COEP headers are
 * server-side, so when they're missing we fall back to the classic
 * runtime with a warning instead of failing inside the kernel worker.
 */
export function isExperimentalKandeloEnabled() {
	const requested =
		new URLSearchParams(window.location.search).get('experimental') ===
		'kandelo';
	if (requested && !window.crossOriginIsolated) {
		logger.warn(
			'?experimental=kandelo needs a cross-origin isolated page, but ' +
				'this server did not send the Cross-Origin-Opener-Policy / ' +
				'Cross-Origin-Embedder-Policy headers. Falling back to the ' +
				'classic Playground runtime.'
		);
		return false;
	}
	return requested;
}

export function getRemoteUrl() {
	const remoteUrl = new URL(window.location.origin);
	remoteUrl.pathname = isExperimentalKandeloEnabled()
		? '/remote-posix-kernel.html'
		: '/remote.html';
	remoteUrl.searchParams.set('v', buildVersion);
	// The e2e "boot-once" suite stashes snapshot URLs on these window globals
	// (set by the Playwright fixtures); forward them to the remote iframe so
	// the kernel boots from them instead of rebuilding + re-installing. The
	// VFS image is the fast path (skips WP extraction + VFS build); the DB is
	// the fallback the kernel seeds when the image is unavailable. No-ops in
	// normal use where the globals are absent.
	const preinstalledDb = (window as any).__playgroundPreinstalledDbUrl;
	if (preinstalledDb) {
		remoteUrl.searchParams.set('preinstalledDb', preinstalledDb);
	}
	const prebuiltVfsImage = (window as any).__playgroundPrebuiltVfsImageUrl;
	if (prebuiltVfsImage) {
		remoteUrl.searchParams.set('prebuiltVfsImage', prebuiltVfsImage);
	}
	return remoteUrl;
}
