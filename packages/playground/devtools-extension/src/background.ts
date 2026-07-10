/**
 * Background service worker for the WordPress Playground DevTools extension.
 *
 * Manages communication between content scripts and the DevTools panel,
 * and tracks which frames have playground instances.
 */

import {
	detectPlaygroundInMainWorld,
	executePlaygroundMethodInMainWorld,
} from './main-world-playground';
import {
	clearTabDocuments,
	commitFrameDocument,
	isCurrentFrameDocument,
	registerFrameDocument,
	type FrameDocumentRegistry,
} from './frame-document-registry';
import {
	advanceFrameScanEpoch,
	clearTabScans,
	isLatestFrameScan,
	type FrameScanRegistry,
} from './frame-scan-registry';

interface PlaygroundFrame {
	frameId: number;
	documentId: string;
	tabId: number;
	url: string;
	hasPlayground: boolean;
	documentRoot?: string;
	playgroundGeneration?: string;
}

const playgroundStateKey =
	'@wp-playground/devtools-extension/playground-generation';

// Store playground frames per tab
const playgroundFrames = new Map<number, Map<number, PlaygroundFrame>>();
const frameDocuments: FrameDocumentRegistry = new Map();
const frameScans: FrameScanRegistry = new Map();

// Store connections to DevTools panels
const devToolsConnections = new Map<number, chrome.runtime.Port>();

/**
 * Handle messages from content scripts.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === 'PLAYGROUND_STATUS' && sender.tab?.id !== undefined) {
		const tabId = sender.tab.id;
		const frameId = sender.frameId ?? 0;
		const documentId = sender.documentId;
		if (
			!documentId ||
			!registerFrameDocument(
				frameDocuments,
				tabId,
				frameId,
				documentId
			) ||
			typeof message.scanEpoch !== 'number' ||
			!isLatestFrameScan(
				frameScans,
				tabId,
				frameId,
				documentId,
				message.scanEpoch
			)
		) {
			return false;
		}
		// DETECT_PLAYGROUND assigned this epoch before sampling the main world.
		// A delayed status cannot overwrite an observation that started later.

		if (!playgroundFrames.has(tabId)) {
			playgroundFrames.set(tabId, new Map());
		}

		const frames = playgroundFrames.get(tabId)!;
		frames.set(frameId, {
			frameId,
			documentId,
			tabId,
			url: message.url,
			hasPlayground: message.hasPlayground,
			documentRoot: message.documentRoot,
			playgroundGeneration: message.playgroundGeneration,
		});

		// Notify the DevTools panel for this tab if connected
		postFrames(tabId);
		return false;
	}

	// Handle DETECT_PLAYGROUND - use chrome.scripting.executeScript to check for window.playground
	if (message.type === 'DETECT_PLAYGROUND' && sender.tab?.id !== undefined) {
		const tabId = sender.tab.id;
		const frameId = sender.frameId ?? 0;
		const documentId = sender.documentId;
		if (
			!documentId ||
			!registerFrameDocument(frameDocuments, tabId, frameId, documentId)
		) {
			sendResponse({ hasPlayground: false });
			return false;
		}
		// Periodic checks carry the epoch allocated by REFRESH_FRAMES. An
		// unsolicited detection allocates one now and returns it with the sample.
		const scanEpoch =
			typeof message.scanEpoch === 'number'
				? message.scanEpoch
				: advanceFrameScanEpoch(frameScans, tabId, frameId, documentId);

		chrome.scripting
			.executeScript({
				target: { tabId, documentIds: [documentId] },
				world: 'MAIN',
				func: detectPlaygroundInMainWorld,
				args: [playgroundStateKey],
			})
			.then((results) => {
				const result = results?.[0]?.result;
				sendResponse({
					...(result || { hasPlayground: false }),
					scanEpoch,
				});
			})
			.catch((error) => {
				// eslint-disable-next-line no-console
				console.error('Failed to detect playground:', error);
				sendResponse({ hasPlayground: false, scanEpoch });
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
		const documentId = sender.documentId;
		const {
			method,
			args,
			documentId: expectedDocumentId,
			playgroundGeneration,
		} = message;
		if (
			!documentId ||
			documentId !== expectedDocumentId ||
			!isCurrentFrameDocument(frameDocuments, tabId, frameId, documentId)
		) {
			sendResponse({
				error: 'The selected Playground instance is no longer available.',
			});
			return false;
		}

		chrome.scripting
			.executeScript({
				target: { tabId, documentIds: [documentId] },
				world: 'MAIN',
				func: executePlaygroundMethodInMainWorld,
				args: [method, args, playgroundGeneration, playgroundStateKey],
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
			postFrames(tabId);
		}

		if (message.type === 'REFRESH_FRAMES' && tabId !== null) {
			// Query every current document exactly once.
			chrome.webNavigation.getAllFrames({ tabId }).then((frames) => {
				if (!frames) return;

				frames.forEach((frame) => {
					if (
						!registerFrameDocument(
							frameDocuments,
							tabId!,
							frame.frameId,
							frame.documentId
						)
					) {
						return;
					}
					const scanEpoch = advanceFrameScanEpoch(
						frameScans,
						tabId!,
						frame.frameId,
						frame.documentId
					);
					chrome.tabs
						.sendMessage(
							tabId!,
							{ type: 'CHECK_PLAYGROUND', scanEpoch },
							{ documentId: frame.documentId }
						)
						.then((response) => {
							if (
								response &&
								response.scanEpoch === scanEpoch &&
								isCurrentFrameDocument(
									frameDocuments,
									tabId!,
									frame.frameId,
									frame.documentId
								) &&
								isLatestFrameScan(
									frameScans,
									tabId!,
									frame.frameId,
									frame.documentId,
									scanEpoch
								)
							) {
								const tabFrames =
									playgroundFrames.get(tabId!) ?? new Map();
								tabFrames.set(frame.frameId, {
									frameId: frame.frameId,
									documentId: frame.documentId,
									tabId: tabId!,
									url: response.url,
									hasPlayground: response.hasPlayground,
									documentRoot: response.documentRoot,
									playgroundGeneration:
										response.playgroundGeneration,
								});
								playgroundFrames.set(tabId!, tabFrames);

								postFrames(tabId!);
							}
						})
						.catch(() => {});
				});
			});
		}

		if (message.type === 'EXECUTE_METHOD' && tabId !== null) {
			const frame = playgroundFrames.get(tabId)?.get(message.frameId);
			if (
				!frame ||
				frame.documentId !== message.documentId ||
				frame.playgroundGeneration !== message.playgroundGeneration
			) {
				port.postMessage({
					type: 'METHOD_RESULT',
					requestId: message.requestId,
					error: 'The selected Playground instance is no longer available.',
				});
				return;
			}

			// Forward method execution to the content script in the specified frame
			chrome.tabs
				.sendMessage(
					tabId,
					{
						type: 'EXECUTE_PLAYGROUND_METHOD',
						method: message.method,
						args: message.args,
						documentId: message.documentId,
						playgroundGeneration: message.playgroundGeneration,
					},
					{ documentId: message.documentId }
				)
				.then((response) => {
					port.postMessage({
						type: 'METHOD_RESULT',
						requestId: message.requestId,
						result: response?.result,
						error: response?.error,
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
	clearTabDocuments(frameDocuments, tabId);
	clearTabScans(frameScans, tabId);
	devToolsConnections.delete(tabId);
});

// Replace frames only after Chrome commits the new document. A canceled
// navigation leaves the existing target valid.
chrome.webNavigation.onCommitted.addListener((details) => {
	if (!details.documentId) {
		return;
	}
	if (details.frameId === 0) {
		// Main frame navigation - clear all frames for this tab
		playgroundFrames.delete(details.tabId);
		clearTabDocuments(frameDocuments, details.tabId);
	} else {
		// Subframe navigation - clear just that frame
		const frames = playgroundFrames.get(details.tabId);
		if (frames) {
			frames.delete(details.frameId);
		}
	}
	commitFrameDocument(
		frameDocuments,
		details.tabId,
		details.frameId,
		details.documentId
	);
	// A BFCache restore reuses its document ID. Advancing here prevents a scan
	// suspended before navigation from becoming current again on restoration.
	advanceFrameScanEpoch(
		frameScans,
		details.tabId,
		details.frameId,
		details.documentId
	);
	postFrames(details.tabId);
});

/** Publishes only detected frames with a complete document-bound identity. */
function postFrames(tabId: number) {
	const port = devToolsConnections.get(tabId);
	if (!port) {
		return;
	}
	port.postMessage({
		type: 'FRAMES_UPDATED',
		frames: Array.from(playgroundFrames.get(tabId)?.values() ?? []).filter(
			(frame) => frame.hasPlayground && frame.playgroundGeneration
		),
	});
}
