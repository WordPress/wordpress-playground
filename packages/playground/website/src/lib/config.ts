// Provided by vite
import { buildVersion } from '@wp-playground/common';
export { buildVersion } from '@wp-playground/common';

export function getRemoteUrl() {
	const remoteUrl = new URL(window.location.origin);
	remoteUrl.pathname = '/remote.html';
	remoteUrl.searchParams.set('v', buildVersion);
	return remoteUrl;
}
