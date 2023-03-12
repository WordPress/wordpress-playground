import type { PlaygroundAPI } from './app';
import { consumeAPI } from '@wordpress/php-wasm'

export function connectToPlayground(iframe: HTMLIFrameElement, url: string) {
	if (!url.endsWith('/wordpress.html')) {
		url = url.replace(/\/+$/, '') + '/wordpress.html';
	}
	iframe.src = url;
	return consumeAPI(iframe.contentWindow!) as PlaygroundAPI;
}
