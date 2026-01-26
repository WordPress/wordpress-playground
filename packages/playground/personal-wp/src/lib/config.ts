// Provided by vite
import { buildVersion } from 'virtual:website-config';
export { buildVersion } from 'virtual:website-config';

export function getRemoteUrl() {
	const remoteUrl = new URL(window.location.origin);
	remoteUrl.pathname = '/remote.html';
	remoteUrl.searchParams.set('v', buildVersion);
	return remoteUrl;
}
