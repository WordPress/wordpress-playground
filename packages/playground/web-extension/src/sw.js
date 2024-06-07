// src/messaging.ts
function sendPhpRequest(request) {
	return new Promise((resolve) => {
		const encodedRequest = { ...request };
		if (encodedRequest.body && encodedRequest.body instanceof Uint8Array) {
			encodedRequest.body = uint8ArrayToBase64(encodedRequest.body);
		}
		chrome.runtime.sendMessage(
			{
				type: 'PLAYGROUND_REQUEST',
				request: encodedRequest,
			},
			(encodedResponse) => {
				const decodedResponse = {
					...encodedResponse,
					bytes: base64ToUint8Array(encodedResponse.bytes),
				};
				resolve(decodedResponse);
			}
		);
	});
}
var uint8ArrayToBase64 = (bytes) => {
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
};
var base64ToUint8Array = (base64) => {
	const byteCharacters = atob(base64);
	const byteNumbers = new Array(byteCharacters.length);
	for (let i = 0; i < byteCharacters.length; i++) {
		byteNumbers[i] = byteCharacters.charCodeAt(i);
	}
	return new Uint8Array(byteNumbers);
};

// src/sw.ts
async function setupOffscreenDocument(path) {
	const offscreenUrl = chrome.runtime.getURL(path);
	const existingContexts = await chrome.runtime.getContexts({
		contextTypes: ['OFFSCREEN_DOCUMENT'],
		documentUrls: [offscreenUrl],
	});
	if (existingContexts.length > 0) {
		return;
	}
	if (creating) {
		await creating;
	} else {
		creating = chrome.offscreen.createDocument({
			url: path,
			reasons: ['BLOBS'],
			justification: 'reason for needing the document',
		});
		await creating;
		creating = null;
	}
}
var creating = null;
setupOffscreenDocument(chrome.runtime.getURL('playground-loader.html'));
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
	console.log('Content script message:', message);
	if (message.type === 'GET_PLAYGROUND_URL') {
		sendResponse({
			url: chrome.runtime.getURL(''),
		});
	}
});
self.addEventListener('fetch', function (event) {
	const requestedPath = new URL(event.request.url).pathname;
	console.log('Fetch intercepted for:', event.request.url);
	if (
		requestedPath.endsWith('/popup.html') ||
		requestedPath.endsWith('/popup.js') ||
		requestedPath.endsWith('/popup.css')
	) {
		return;
	}
	event.respondWith(
		(async function () {
			const url = new URL(event.request.url);
			const contentType = event.request.headers.get('content-type');
			const body =
				event.request.method === 'POST'
					? new Uint8Array(await event.request.clone().arrayBuffer())
					: undefined;
			const requestHeaders = {};
			for (const pair of event.request.headers.entries()) {
				requestHeaders[pair[0]] = pair[1];
			}
			const phpRequest = {
				body,
				url: url.toString(),
				method: event.request.method,
				headers: {
					...requestHeaders,
					Host: url.host,
					'User-agent': self.navigator.userAgent,
					'Content-type': contentType,
				},
			};
			const phpResponse = await sendPhpRequest(phpRequest);
			delete phpResponse.headers['x-frame-options'];
			return new Response(phpResponse.bytes, {
				headers: phpResponse.headers,
				status: phpResponse.httpStatusCode,
			});
		})()
	);
});
chrome.action.onClicked.addListener(async function (tab) {
	chrome.scripting.executeScript({
		target: { tabId: tab.id },
		func: () => {
			const oldIframe = document.getElementById('cm-frame');
			if (oldIframe) {
				oldIframe.remove();
				return;
			}
			const iframe = document.createElement('iframe');
			iframe.setAttribute('id', 'cm-frame');
			iframe.setAttribute(
				'style',
				'top: 10px;right: 10px;width: 60vw;height:60vh;z-index: 2147483650;border: none; position:fixed;'
			);
			iframe.setAttribute('allow', '');
			iframe.src = chrome.runtime.getURL(
				'popup.html?next=' +
					chrome.runtime.getURL(
						'/wp-admin/post-new.php?post_type=post'
					)
			);
			document.body.appendChild(iframe);
		},
	});
});
