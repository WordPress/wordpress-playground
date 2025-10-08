// Provided by vite
import { buildVersion } from 'virtual:build-version';
export { buildVersion } from 'virtual:build-version';

export function getRemoteUrl() {
	const remoteUrl = new URL(window.location.origin);
	remoteUrl.pathname = '/remote.html';
	remoteUrl.searchParams.set('v', buildVersion);
	return remoteUrl;
}
