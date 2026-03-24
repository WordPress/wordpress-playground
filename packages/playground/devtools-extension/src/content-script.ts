/**
 * Content script that runs in every frame to detect window.playground instances.
 *
 * This script is injected into all frames and checks for the presence of
 * window.playground. Since content scripts run in an isolated world, we need
 * to communicate with the background script to execute code in the page context.
 */

/**
 * Check for window.playground by asking the background script to execute
 * code in the page context using chrome.scripting.executeScript.
 */
function checkForPlayground(): Promise<{
	hasPlayground: boolean;
	documentRoot?: string;
}> {
	return new Promise((resolve) => {
		chrome.runtime.sendMessage(
			{ type: 'DETECT_PLAYGROUND' },
			(response) => {
				if (chrome.runtime.lastError) {
					resolve({ hasPlayground: false });
					return;
				}
				resolve(response || { hasPlayground: false });
			}
		);
	});
}

/**
 * Send the current frame's playground status to the background script.
 */
async function reportPlaygroundStatus() {
	const result = await checkForPlayground();

	chrome.runtime.sendMessage({
		type: 'PLAYGROUND_STATUS',
		hasPlayground: result.hasPlayground,
		documentRoot: result.documentRoot,
		url: window.location.href,
	});
}

// Check immediately when the script loads
reportPlaygroundStatus();

// Listen for requests from the DevTools panel to check again
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === 'CHECK_PLAYGROUND') {
		checkForPlayground().then((result) => {
			sendResponse({
				hasPlayground: result.hasPlayground,
				documentRoot: result.documentRoot,
				url: window.location.href,
			});
		});
		return true; // Keep the message channel open for async response
	}

	if (message.type === 'EXECUTE_PLAYGROUND_METHOD') {
		// Execute a method on window.playground and return the result
		executePlaygroundMethod(message.method, message.args).then(
			sendResponse
		);
		return true;
	}
});

/**
 * Execute a method on window.playground by asking the background script
 * to use chrome.scripting.executeScript.
 */
function executePlaygroundMethod(
	method: string,
	args: unknown[]
): Promise<unknown> {
	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage(
			{ type: 'EXEC_PLAYGROUND_METHOD', method, args },
			(response) => {
				if (chrome.runtime.lastError) {
					reject(new Error(chrome.runtime.lastError.message));
					return;
				}
				if (response?.error) {
					reject(new Error(response.error));
				} else {
					resolve(response?.result);
				}
			}
		);
	});
}
