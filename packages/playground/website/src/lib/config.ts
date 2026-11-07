// Provided by vite
import { buildVersion } from 'virtual:website-config';
import { getReleaseRoot } from '@wp-playground/common';
export { buildVersion } from 'virtual:website-config';

/** Keep PHP and its directory handles on the app origin; only WordPress moves. */
export function getRemoteUrl() {
	const releaseRoot = getReleaseRoot(new URL((import.meta || {}).url));
	const remoteUrl = new URL(
		'remote.html',
		releaseRoot ?? new URL('/', window.location.origin)
	);
	remoteUrl.searchParams.set('v', buildVersion);
	return remoteUrl;
}
