import { getURLScope } from '@php-wasm/scopes';
import { wordPressSandboxOrigin } from './config';

/**
 * Opens a WordPress tool in a popup with the same frame layout as the main app:
 * an app-origin top-level page containing a WordPress-origin iframe.
 *
 * Browsers can select service-worker registrations using both the WordPress
 * origin and the top-level site. Opening WordPress directly can then miss the
 * worker serving it inside the main app. This app-origin wrapper preserves
 * that top-level site, so #wp can use the existing worker and PHP instance.
 *
 * The hash supplies the destination. Accept only scoped WordPress URLs so this
 * wrapper cannot be used to load trusted app documents into the iframe.
 */
function bootWordPressPopup() {
	const target = new URL(location.hash.substring(1), wordPressSandboxOrigin);
	if (target.origin !== wordPressSandboxOrigin || !getURLScope(target)) {
		throw new Error('The popup URL must name a scoped WordPress page.');
	}
	const frame = document.querySelector('#wp') as HTMLIFrameElement;
	frame.src = target.href;
}

bootWordPressPopup();
