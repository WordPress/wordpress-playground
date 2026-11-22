import { getRemoteUrl } from './config';

/** Keep a split-origin popup in the same service-worker partition as the running site. */
export function getWordPressPopupUrl(url: string): string {
	const target = new URL(url);
	const remote = getRemoteUrl();
	if (target.origin === remote.origin) {
		return target.href;
	}
	remote.pathname = '/wordpress-popup.html';
	remote.search = '';
	remote.hash = target.pathname + target.search + target.hash;
	return remote.href;
}
