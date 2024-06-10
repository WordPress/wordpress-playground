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
		return;
	}

	creating = createOffscreenDocument({
		url: path,
		reasons: ['BLOBS' as any],
		justification: 'reason for needing the document',
	});
	await creating;
	creating = null;
}

async function createOffscreenDocument(
	options: chrome.offscreen.CreateParameters
) {
	try {
		// In rare cases, the createDocument call may fail due to the extension already
		// having one document even in scenarios when the getContexts call above returned
		// no contexts. I only saw it happening once and it could have been intermittent,
		// but I'm still putting a failsafe in place.
		// @TODO: Isolate the failure and get to the bottom of it.
		return chrome.offscreen.createDocument(options);
	} catch (e) {
		await chrome.offscreen.closeDocument();
		return chrome.offscreen.createDocument(options);
	}
}

setupOffscreenDocument(chrome.runtime.getURL('playground-loader.html'));
