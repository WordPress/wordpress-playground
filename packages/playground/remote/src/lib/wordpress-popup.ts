import { getURLScope } from '@php-wasm/scopes';
import { wordPressSiteUrl } from './config';

/** Keep popup WordPress in the app's service-worker partition without exposing app documents. */
function bootWordPressPopup() {
	const target = new URL(location.hash.substring(1), wordPressSiteUrl);
	if (target.origin !== wordPressSiteUrl || !getURLScope(target)) {
		throw new Error('The popup URL must name a scoped WordPress page.');
	}
	const frame = document.querySelector('#wp') as HTMLIFrameElement;
	frame.src = target.href;
}

bootWordPressPopup();
