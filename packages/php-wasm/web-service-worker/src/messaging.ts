const DEFAULT_RESPONSE_TIMEOUT = 5000;

let lastRequestId = 0;

export function getNextRequestId() {
	return ++lastRequestId;
}

/**
 * Awaits a reply to the message with the given ID.
 *
 * @see postMessageExpectReply
 * @throws {@link Error} If the reply is not received within the timeout.
 * @param  messageTarget EventEmitter emitting `message` events, e.g. `window`
 *                       or a `Worker` instance.
 * @param  requestId     The message ID returned by postMessageExpectReply().
 * @param  timeout       The number of milliseconds to wait for a reply before
 *                       throwing an error.
 * @returns The reply from the messageTarget.
 */
export function awaitReply(
	messageTarget: IsomorphicEventTarget,
	requestId: number,
	timeout: number = DEFAULT_RESPONSE_TIMEOUT
): Promise<any> {
	console.log(`called awaitReply(..., ${requestId}, ${timeout})`);
	return new Promise((resolve, reject) => {
		console.log('I am in a promise', { requestId });
		const responseHandler = (event: MessageEvent) => {
			console.log('responseHandler(', event, ')');
			if (
				event.data.type === 'response' &&
				event.data.requestId === requestId
			) {
				messageTarget.removeEventListener('message', responseHandler);
				clearTimeout(failOntimeout);
				resolve(event.data.response);
			}
		};

		const failOntimeout = setTimeout(() => {
			console.log('failOntimeout()');
			reject(new Error('Request timed out'));
			messageTarget.removeEventListener('message', responseHandler);
		}, timeout);

		console.log('pre messageTarget.addEventListener');
		messageTarget.addEventListener('message', responseHandler);
		console.log('post messageTarget.addEventListener');
	});
}

/**
 * Creates a response message to the given message ID.
 *
 * @see postMessageExpectReply
 * @param  requestId The message ID sent from the other thread by
 *                   `postMessageExpectReply` in the `message` event.
 * @param  response  The response to send back to the messageTarget.
 * @returns A message object that can be sent back to the other thread.
 */
export function responseTo<T>(
	requestId: number,
	response: T
): MessageResponse<T> {
	return {
		type: 'response',
		requestId,
		response,
	};
}

export interface MessageResponse<T> {
	type: 'response';
	requestId: number;
	response: T;
}

interface IsomorphicEventTarget {
	addEventListener(type: string, listener: (event: any) => void): void;
	removeEventListener(type: string, listener: (event: any) => void): void;
}
