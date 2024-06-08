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
		// } else if (message.type === 'EDIT_IN_PLAYGROUND') {
	}
});

self.addEventListener('fetch', function (event: any) {
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

async function editInPlayground(uuid: string) {
	const url = new URL(chrome.runtime.getURL('/popup.html'));
	url.searchParams.set('uuid', uuid);
	url.searchParams.set(
		'next',
		chrome.runtime.getURL('/wp-admin/post-new.php?post_type=post')
	);
	const window = await chrome.windows.create({
		url: url.toString(),
		type: 'popup',
		width: 800,
		height: 600,
	});

	globalThis.addEventListener('message', async (event) => {
		console.log('Got message!', event);
	});

	// Listen to postMessage from the created window
	window.tabs?.[0].id &&
		chrome.tabs.onMessage.addListener(function (
			message,
			sender,
			sendResponse
		) {
			console.log('Got message from a tab!');
		});

	// chrome.scripting.executeScript({
	//   target: { tabId: tab.id },
	//   func: () => {
	// 	const oldIframe = document.getElementById('cm-frame');

	// 	if (oldIframe) {
	// 	  oldIframe.remove();
	// 	  return;
	// 	}

	// const iframe = document.createElement('iframe');
	// iframe.setAttribute('id', 'cm-frame');
	// iframe.setAttribute(
	// 	'style',
	// 	'top: 10px;right: 10px;width: 60vw;height:60vh;z-index: 2147483650;border: none; position:fixed;'
	// );
	// iframe.setAttribute('allow', '');
	// iframe.src = chrome.runtime.getURL('/popup.html');
	// iframe.src = chrome.runtime.getURL('/wp-admin/post-new.php?post_type=post&uuid=ccc25e2e-d1c8-427a-8a2d-41759e0b0406');
	// document.body.appendChild(iframe);
}

chrome.action.onClicked.addListener(async function (tab) {
	// editInPlayground('a');
	// chrome.windows.create({
	// 	url: chrome.runtime.getURL('/wp-admin/post-new.php'),
	// 	type: 'popup',
	// 	width: 800,
	// 	height: 600,
	// });
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
			// iframe.src = chrome.runtime.getURL('/wp-admin/post-new.php?post_type=post&uuid=ccc25e2e-d1c8-427a-8a2d-41759e0b0406');
			document.body.appendChild(iframe);
		},
	});
});
