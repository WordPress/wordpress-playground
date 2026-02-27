/**
 * Listens for a JSPI polyfill channel message from the
 * worker and starts the main-thread request handler.
 */

import { startMainThreadHandler } from './main-thread-handler';
import { wrapSharedChannel } from './shared-channel';

export function setupJspiPolyfillListener(worker: Worker): void {
	worker.addEventListener('message', (event: MessageEvent) => {
		if (event.data?.type === 'jspi-polyfill-channel') {
			const channel = wrapSharedChannel(event.data.sab);
			startMainThreadHandler(channel);
		}
	});
}
