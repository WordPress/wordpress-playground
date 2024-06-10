// ../../php-wasm/web-service-worker/src/messaging.ts
function postMessageExpectReply(target, message, ...postMessageArgs) {
	const requestId = getNextRequestId();
	target.postMessage(
		{
			...message,
			requestId,
		},
		...postMessageArgs
	);
	return requestId;
}
function getNextRequestId() {
	return ++lastRequestId;
}
function awaitReply(
	messageTarget,
	requestId,
	timeout = DEFAULT_RESPONSE_TIMEOUT
) {
	return new Promise((resolve, reject) => {
		const responseHandler = (event) => {
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
			reject(new Error('Request timed out'));
			messageTarget.removeEventListener('message', responseHandler);
		}, timeout);
		messageTarget.addEventListener('message', responseHandler);
	});
}
function responseTo(requestId, response) {
	return {
		type: 'response',
		requestId,
		response,
	};
}
var DEFAULT_RESPONSE_TIMEOUT = 25000;
var lastRequestId = 0;
// loopback-service-worker/index.ts
var sw = navigator.serviceWorker;
if (!sw) {
	if (window.isSecureContext) {
		throw new Error('Service workers are not supported in your browser.');
	} else {
		throw new Error(
			'WordPress Playground uses service workers and may only work on HTTPS and http://localhost/ sites, but the current site is neither.'
		);
	}
}
var registration = await sw.register('/service-worker.js', {
	updateViaCache: 'none',
});
await registration.update();
navigator.serviceWorker.addEventListener(
	'message',
	async function onMessage(event) {
		const requestId = postMessageExpectReply(
			window.parent,
			{
				type: 'playground-extension-sw-message',
				data: event.data,
			},
			'*'
		);
		const response = await awaitReply(window, requestId);
		event.source.postMessage(responseTo(event.data.requestId, response));
	}
);
sw.startMessages();
