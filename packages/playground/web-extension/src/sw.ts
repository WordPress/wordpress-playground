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
