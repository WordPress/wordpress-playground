import type { Remote } from 'comlink';
import type { PlaygroundClient } from '@wp-playground/remote';
import { consumeAPI } from '@php-wasm/web';
export type {
	HTTPMethod,
	PHPRunOptions,
	PHPRequest,
	PHPResponse,
} from '@php-wasm/web';
export * from './lib';

export type { PlaygroundClient };

export interface ConnectPlaygroundOptions {
	loadRemote?: string;
}

/**
 * Connects to a playground iframe and returns a PlaygroundClient instance.
 *
 * @param iframe Any iframe with Playground's remote.html loaded.
 * @param options Optional. If `loadRemote` is set, the iframe's `src` will be set to that URL.
 *                In other words, use this option if your iframe doesn't have remote.html already
 * 				  loaded.
 * @returns A PlaygroundClient instance.
 */
export async function connectPlayground(
	iframe: HTMLIFrameElement,
	options?: ConnectPlaygroundOptions
): Promise<PlaygroundClient> {
	if (options?.loadRemote) {
		iframe.src = options?.loadRemote;
		await new Promise((resolve) => {
			iframe.addEventListener('load', resolve, false);
		});
	}
	const comlinkClient: Remote<PlaygroundClient> =
		consumeAPI<PlaygroundClient>(iframe.contentWindow!);

	/*
	 * Wait for any response from the playground to ensure the comlink
	 * handler on the other side is ready:
	 */
	await comlinkClient.absoluteUrl;

	/*
	 * PlaygroundClient is compatible with Remote<PlaygroundClient>,
	 * but has a better DX. Let's for a typecast:
	 */
	return comlinkClient as PlaygroundClient;
}
