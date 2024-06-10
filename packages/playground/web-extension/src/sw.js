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
		return;
	}
	creating = createOffscreenDocument({
		url: path,
		reasons: ['BLOBS'],
		justification: 'reason for needing the document',
	});
	await creating;
	creating = null;
}
async function createOffscreenDocument(options) {
	try {
		return chrome.offscreen.createDocument(options);
	} catch (e) {
		await chrome.offscreen.closeDocument();
		return chrome.offscreen.createDocument(options);
	}
}
var creating = null;
setupOffscreenDocument(chrome.runtime.getURL('playground-loader.html'));
