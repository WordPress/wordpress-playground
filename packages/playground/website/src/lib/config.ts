// Provided by vite
import { buildVersion } from 'virtual:website-config';
export { buildVersion } from 'virtual:website-config';

// Capture the startup choice before SPA navigation replaces the query string.
// A full reload without ?reprint deliberately returns to one-origin WordPress.
const useWordPressSandbox = new URLSearchParams(
	globalThis.location?.search
).has('reprint');

/** Keep each new PHP iframe in this page's startup mode when switching sites. */
export function getRemoteUrl() {
	const remoteUrl = new URL(window.location.origin);
	remoteUrl.pathname = '/remote.html';
	remoteUrl.searchParams.set('v', buildVersion);
	if (useWordPressSandbox) remoteUrl.searchParams.set('reprint', '');
	return remoteUrl;
}
