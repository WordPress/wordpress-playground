import { PHPRequest, PHPResponse } from '@php-wasm/universal';
import { sendPhpRequest } from './messaging';

let creating: Promise<void> | null = null; // A global promise to avoid concurrency issues
async function setupOffscreenDocument(path: string) {
	// Check all windows controlled by the service worker to see if one
	// of them is the offscreen document with the given path
	const offscreenUrl = chrome.runtime.getURL(path);
	const existingContexts = await chrome.runtime.getContexts({
		contextTypes: ['OFFSCREEN_DOCUMENT' as any],
		documentUrls: [offscreenUrl],
	});

	if (existingContexts.length > 0) {
		return;
	}

	// create offscreen document
	if (creating) {
		await creating;
	} else {
		creating = chrome.offscreen.createDocument({
			url: path,
			reasons: ['BLOBS' as any],
			justification: 'reason for needing the document',
		});
		await creating;
		creating = null;
	}
}

setupOffscreenDocument(chrome.runtime.getURL('playground-loader.html'));

// Listen to content script messages
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
	console.log('Content script message:', message);
	if (message.type === 'GET_PLAYGROUND_URL') {
		sendResponse({
			url: chrome.runtime.getURL(''),
		});
	}
});

self.addEventListener('fetch', function (event: any) {
	console.log('Fetch intercepted for:', event.request.url);
	if (event.request.url.endsWith('/popup.html')) {
		return;
	}
	event.respondWith(
		(async function () {
			const url = new URL(event.request.url);

			const contentType = event.request.headers.get('content-type')!;
			const body =
				event.request.method === 'POST'
					? new Uint8Array(await event.request.clone().arrayBuffer())
					: undefined;
			const requestHeaders: Record<string, string> = {};
			for (const pair of (event.request.headers as any).entries()) {
				requestHeaders[pair[0]] = pair[1];
			}

			const phpRequest = {
				body,
				url: url.toString(),
				method: event.request.method,
				headers: {
					...requestHeaders,
					Host: url.host,
					// Safari and Firefox don't make the User-Agent header
					// available in the fetch event. Let's add it manually:
					'User-agent': self.navigator.userAgent,
					'Content-type': contentType,
				},
			};
			const phpResponse = await sendPhpRequest(phpRequest);
			// X-frame-options gets in a way when PHP is
			// being displayed in an iframe.
			delete phpResponse.headers['x-frame-options'];
			return new Response(phpResponse.bytes, {
				headers: phpResponse.headers as any,
				status: phpResponse.httpStatusCode,
			});
		})()
	);
});

// chrome.action.onClicked.addListener(async function (tab) {
// 	chrome.scripting.executeScript({
// 	  target: { tabId: tab.id },
// 	  func: () => {
// 		const oldIframe = document.getElementById('cm-frame');

// 		if (oldIframe) {
// 		  oldIframe.remove();
// 		  return;
// 		}

// 		const iframe = document.createElement('iframe');
// 		iframe.setAttribute('id', 'cm-frame');
// 		iframe.setAttribute(
// 		  'style',
// 		  'top: 10px;right: 10px;width: 60vw;height:60vh;z-index: 2147483650;border: none; position:fixed;'
// 		);
// 		iframe.setAttribute('allow', '');
// 		iframe.src = chrome.runtime.getURL('/popup.html');

// 		document.body.appendChild(iframe);
// 	  },
// 	});
// });
