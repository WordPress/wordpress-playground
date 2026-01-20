/**
 * Background service worker for the WordPress Playground DevTools extension.
 *
 * Manages communication between content scripts and the DevTools panel,
 * and tracks which frames have playground instances.
 */

interface PlaygroundFrame {
	frameId: number;
	tabId: number;
	url: string;
	hasPlayground: boolean;
	documentRoot?: string;
}

// Store playground frames per tab
const playgroundFrames = new Map<number, Map<number, PlaygroundFrame>>();

// Store connections to DevTools panels
const devToolsConnections = new Map<number, chrome.runtime.Port>();

/**
 * Handle messages from content scripts.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === 'PLAYGROUND_STATUS' && sender.tab?.id !== undefined) {
		const tabId = sender.tab.id;
		const frameId = sender.frameId ?? 0;

		if (!playgroundFrames.has(tabId)) {
			playgroundFrames.set(tabId, new Map());
		}

		const frames = playgroundFrames.get(tabId)!;
		frames.set(frameId, {
			frameId,
			tabId,
			url: message.url,
			hasPlayground: message.hasPlayground,
			documentRoot: message.documentRoot,
		});

		// Notify the DevTools panel for this tab if connected
		const port = devToolsConnections.get(tabId);
		if (port) {
			port.postMessage({
				type: 'FRAMES_UPDATED',
				frames: Array.from(frames.values()).filter(
					(f) => f.hasPlayground
				),
			});
		}
		return false;
	}

	// Handle DETECT_PLAYGROUND - use chrome.scripting.executeScript to check for window.playground
	if (message.type === 'DETECT_PLAYGROUND' && sender.tab?.id !== undefined) {
		const tabId = sender.tab.id;
		const frameId = sender.frameId ?? 0;

		chrome.scripting
			.executeScript({
				target: { tabId, frameIds: [frameId] },
				world: 'MAIN',
				func: () => {
					const hasPlayground =
						typeof (window as any).playground !== 'undefined' &&
						(window as any).playground !== null;
					let documentRoot: string | undefined = undefined;
					if (hasPlayground) {
						const pg = (window as any).playground;
						if (typeof pg.documentRoot === 'string') {
							documentRoot = pg.documentRoot;
						}
					}
					return { hasPlayground, documentRoot };
				},
			})
			.then((results) => {
				const result = results?.[0]?.result;
				sendResponse(result || { hasPlayground: false });
			})
			.catch((error) => {
				// eslint-disable-next-line no-console
				console.error('Failed to detect playground:', error);
				sendResponse({ hasPlayground: false });
			});

		return true; // Keep message channel open for async response
	}

	// Handle EXEC_PLAYGROUND_METHOD - execute a method on window.playground
	if (
		message.type === 'EXEC_PLAYGROUND_METHOD' &&
		sender.tab?.id !== undefined
	) {
		const tabId = sender.tab.id;
		const frameId = sender.frameId ?? 0;
		const { method, args } = message;

		chrome.scripting
			.executeScript({
				target: { tabId, frameIds: [frameId] },
				world: 'MAIN',
				func: async (methodName: string, methodArgs: unknown[]) => {
					try {
						const pg = (window as any).playground;
						if (!pg) {
							throw new Error(
								'window.playground is not available'
							);
						}
						if (typeof pg[methodName] !== 'function') {
							throw new Error(
								`Method ${methodName} is not a function on window.playground`
							);
						}
						let result = await pg[methodName](...methodArgs);
						// Handle ArrayBuffer/Uint8Array results by converting to array
						if (result instanceof Uint8Array) {
							result = {
								__type: 'Uint8Array',
								data: Array.from(result),
							};
						} else if (result instanceof ArrayBuffer) {
							result = {
								__type: 'Uint8Array',
								data: Array.from(new Uint8Array(result)),
							};
						}
						return { result };
					} catch (error: any) {
						return { error: error.message || String(error) };
					}
				},
				args: [method, args],
			})
			.then((results) => {
				const response = results?.[0]?.result;
				sendResponse(
					response || { error: 'No result from script execution' }
				);
			})
			.catch((error) => {
				sendResponse({
					error: error.message || 'Script execution failed',
				});
			});

		return true; // Keep message channel open for async response
	}

	return false;
});

/**
 * Handle connections from DevTools panels.
 */
chrome.runtime.onConnect.addListener((port) => {
	if (port.name !== 'playground-devtools') {
		return;
	}

	let tabId: number | null = null;

	port.onMessage.addListener((message) => {
		if (message.type === 'INIT') {
			tabId = message.tabId;
			if (tabId === null) {
				return;
			}
			devToolsConnections.set(tabId, port);

			// Send current frames to the newly connected panel
			const frames = playgroundFrames.get(tabId);
			if (frames) {
				port.postMessage({
					type: 'FRAMES_UPDATED',
					frames: Array.from(frames.values()).filter(
						(f) => f.hasPlayground
					),
				});
			}
		}

		if (message.type === 'REFRESH_FRAMES' && tabId !== null) {
			// Request all frames in the tab to re-check for playground
			chrome.tabs
				.sendMessage(
					tabId,
					{ type: 'CHECK_PLAYGROUND' },
					{ frameId: 0 }
				)
				.catch(() => {});

			// Also query all frames
			chrome.webNavigation.getAllFrames({ tabId }).then((frames) => {
				if (!frames) return;

				frames.forEach((frame) => {
					chrome.tabs
						.sendMessage(
							tabId!,
							{ type: 'CHECK_PLAYGROUND' },
							{ frameId: frame.frameId }
						)
						.then((response) => {
							if (response) {
								const tabFrames =
									playgroundFrames.get(tabId!) ?? new Map();
								tabFrames.set(frame.frameId, {
									frameId: frame.frameId,
									tabId: tabId!,
									url: response.url,
									hasPlayground: response.hasPlayground,
									documentRoot: response.documentRoot,
								});
								playgroundFrames.set(tabId!, tabFrames);

								const port = devToolsConnections.get(tabId!);
								if (port) {
									port.postMessage({
										type: 'FRAMES_UPDATED',
										frames: Array.from(
											tabFrames.values()
										).filter((f) => f.hasPlayground),
									});
								}
							}
						})
						.catch(() => {});
				});
			});
		}

		if (message.type === 'EXECUTE_METHOD' && tabId !== null) {
			// Forward method execution to the content script in the specified frame
			chrome.tabs
				.sendMessage(
					tabId,
					{
						type: 'EXECUTE_PLAYGROUND_METHOD',
						method: message.method,
						args: message.args,
					},
					{ frameId: message.frameId }
				)
				.then((result) => {
					port.postMessage({
						type: 'METHOD_RESULT',
						requestId: message.requestId,
						result,
					});
				})
				.catch((error) => {
					port.postMessage({
						type: 'METHOD_RESULT',
						requestId: message.requestId,
						error: error.message,
					});
				});
		}
	});

	port.onDisconnect.addListener(() => {
		if (tabId !== null) {
			devToolsConnections.delete(tabId);
		}
	});
});

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
	playgroundFrames.delete(tabId);
	devToolsConnections.delete(tabId);
});

// Clean up frames when navigation happens
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
	if (details.frameId === 0) {
		// Main frame navigation - clear all frames for this tab
		playgroundFrames.delete(details.tabId);
	} else {
		// Subframe navigation - clear just that frame
		const frames = playgroundFrames.get(details.tabId);
		if (frames) {
			frames.delete(details.frameId);
		}
	}
});
