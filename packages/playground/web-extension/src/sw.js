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
