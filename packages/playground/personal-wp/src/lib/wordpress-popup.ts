import { getRemoteUrl } from './config';

/** Open split-origin tools through Personal WP's permission-delegating popup document. */
export function getWordPressPopupUrl(url: string): string {
	const target = new URL(url);
	if (target.origin === getRemoteUrl().origin) {
		return target.href;
	}
	const popup = new URL(
		'wordpress-popup.html',
		new URL(import.meta.env.BASE_URL, window.location.origin)
	);
	popup.hash = target.href;
	return popup.href;
}
