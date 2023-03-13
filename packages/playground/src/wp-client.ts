import type { PlaygroundAPI } from './boot-playground';
import { consumeAPI } from '@wordpress/php-wasm'

export async function connectToPlayground(iframe: HTMLIFrameElement, url: string) {
	iframe.src = url;
	await new Promise((resolve) => {
		iframe.addEventListener('load', resolve, false);
	});
	return consumeAPI(iframe.contentWindow!) as PlaygroundAPI;
}
