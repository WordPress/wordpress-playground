import type { Remote } from 'comlink';
import type { PlaygroundClient } from '@wp-playground/playground-remote';
import { consumeAPI } from '@php-wasm/web';
export * from './lib';

export type { PlaygroundClient };
export async function connectPlayground(
	iframe: HTMLIFrameElement,
	playgroundUrl: string
): Promise<PlaygroundClient> {
	iframe.src = playgroundUrl;
	await new Promise((resolve) => {
		iframe.addEventListener('load', resolve, false);
	});
	const comlinkClient: Remote<PlaygroundClient> =
		consumeAPI<PlaygroundClient>(iframe.contentWindow!);

	// Wait for any response from the playground to ensure the comlink
	// handler on the other side is ready:
	await comlinkClient.absoluteUrl;

	/*
	 * PlaygroundClient is compatible with Remote<PlaygroundClient>,
	 * but has a better DX. Let's for a typecast:
	 */
	return comlinkClient as PlaygroundClient;
}
