// Provided by vite
import { buildVersion } from 'virtual:website-config';
import {
	getPlaygroundPrPreview,
	playgroundPrParam,
	playgroundPrShaParam,
} from './playground-pr-preview';
export { buildVersion } from 'virtual:website-config';

export function getRemoteUrl() {
	const remoteUrl = new URL(window.location.origin);
	remoteUrl.pathname = '/remote.html';
	remoteUrl.searchParams.set('v', buildVersion);

	const preview = getPlaygroundPrPreview();
	if (preview) {
		remoteUrl.searchParams.set(playgroundPrParam, preview.pr);
		if (preview.sha) {
			remoteUrl.searchParams.set(playgroundPrShaParam, preview.sha);
		}
	}

	return remoteUrl;
}
