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
	REQUEST_FETCH_URL,
	REQUEST_FETCH_URL_CHUNK,
} from './shared-channel';

/**
 * Starts listening for requests on the given channel.
 * Returns a handle with a `cancel()` method to stop
 * listening.
 */
export function startMainThreadHandler(channel: SharedChannel): {
	cancel: () => void;
} {
	let storedFetchResponse: Uint8Array | null = null;

	return waitForRequestAsync(channel, async () => {
		const request = readRequest(channel);
		switch (request.requestType) {
			case REQUEST_SLEEP:
				await handleSleep(request.params[0]);
				sendResponseToWorker(channel, 0);
				break;
			case REQUEST_FETCH_URL:
				storedFetchResponse = await handleFetchUrl(channel, request);
				break;
			case REQUEST_FETCH_URL_CHUNK:
				handleFetchUrlChunk(channel, request, storedFetchResponse);
				break;
			default:
				// Unknown request type — respond with error.
				sendResponseToWorker(channel, 1);
				break;
		}
	});
}

async function handleSleep(ms: number): Promise<void> {
	await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches the URL, stores the full response body, and sends
 * the first chunk back with a 4-byte total-length prefix.
 * Returns the stored response for subsequent chunk requests.
 */
async function handleFetchUrl(
	channel: SharedChannel,
	request: MainThreadRequest
): Promise<Uint8Array | null> {
	const url = new TextDecoder().decode(request.data);
	let body: Uint8Array;
	try {
		const response = await fetch(url);
		body = new Uint8Array(await response.arrayBuffer());
	} catch {
		sendResponseToWorker(channel, 1);
		return null;
	}

	const maxChunk = channel.dataView.byteLength - 4;
	const chunkSize = Math.min(body.length, maxChunk);
	const responseData = new Uint8Array(4 + chunkSize);
	new DataView(responseData.buffer).setUint32(0, body.length, true);
	responseData.set(body.subarray(0, chunkSize), 4);
	sendResponseToWorker(channel, 0, responseData);

	return body;
}

/**
 * Sends the next chunk of the stored fetch response at
 * the requested offset.
 */
function handleFetchUrlChunk(
	channel: SharedChannel,
	request: MainThreadRequest,
	storedFetchResponse: Uint8Array | null
): void {
	const offset = request.params[0];
	if (!storedFetchResponse || offset >= storedFetchResponse.length) {
		sendResponseToWorker(channel, 1);
		return;
	}

	const maxChunk = channel.dataView.byteLength;
	const remaining = storedFetchResponse.length - offset;
	const chunkSize = Math.min(remaining, maxChunk);
	sendResponseToWorker(
		channel,
		0,
		storedFetchResponse.subarray(offset, offset + chunkSize)
	);
}
