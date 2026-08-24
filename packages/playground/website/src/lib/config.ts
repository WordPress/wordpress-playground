// Provided by vite
import { buildVersion } from 'virtual:website-config';
export { buildVersion } from 'virtual:website-config';

export function getRemoteUrl() {
	const remoteUrl = new URL(window.location.origin);
	remoteUrl.pathname = '/remote.html';
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
