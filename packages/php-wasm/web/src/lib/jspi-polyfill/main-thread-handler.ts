/**
 * Main-thread async request handler for the JSPI polyfill.
 *
 * Listens for requests from the worker via the
 * SharedArrayBuffer channel, dispatches to the appropriate
 * handler based on requestType, performs the async
 * operation, and sends the response back.
 */

import type { SharedChannel, MainThreadRequest } from './shared-channel';
import {
	readRequest,
	sendResponseToWorker,
	waitForRequestAsync,
	REQUEST_SLEEP,
} from './shared-channel';

/**
 * Starts listening for requests on the given channel.
 * Returns a handle with a `cancel()` method to stop
 * listening.
 */
export function startMainThreadHandler(channel: SharedChannel): {
	cancel: () => void;
} {
	return waitForRequestAsync(channel, async () => {
		const request = readRequest(channel);
		await handleRequest(channel, request);
	});
}

async function handleRequest(
	channel: SharedChannel,
	request: MainThreadRequest
): Promise<void> {
	switch (request.requestType) {
		case REQUEST_SLEEP:
			await handleSleep(request.params[0]);
			sendResponseToWorker(channel, 0);
			break;
		default:
			// Unknown request type — respond with error.
			sendResponseToWorker(channel, 1);
			break;
	}
}

async function handleSleep(ms: number): Promise<void> {
	await new Promise<void>((resolve) => setTimeout(resolve, ms));
}
