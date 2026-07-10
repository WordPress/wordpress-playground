export type FrameDocumentRegistry = Map<number, Map<number, string>>;

/**
 * Records a document when the frame has no newer committed document.
 *
 * Returning false lets late content-script and refresh responses die without
 * resurrecting the document that previously occupied the frame.
 */
export function registerFrameDocument(
	registry: FrameDocumentRegistry,
	tabId: number,
	frameId: number,
	documentId: string
): boolean {
	let tabDocuments = registry.get(tabId);
	if (!tabDocuments) {
		tabDocuments = new Map();
		registry.set(tabId, tabDocuments);
	}
	const currentDocumentId = tabDocuments.get(frameId);
	if (currentDocumentId !== undefined && currentDocumentId !== documentId) {
		return false;
	}
	tabDocuments.set(frameId, documentId);
	return true;
}

/** Replaces a frame's document after Chrome commits a navigation. */
export function commitFrameDocument(
	registry: FrameDocumentRegistry,
	tabId: number,
	frameId: number,
	documentId: string
): void {
	let tabDocuments = registry.get(tabId);
	if (!tabDocuments) {
		tabDocuments = new Map();
		registry.set(tabId, tabDocuments);
	}
	tabDocuments.set(frameId, documentId);
}

/** Reports whether a response still belongs to the committed frame document. */
export function isCurrentFrameDocument(
	registry: FrameDocumentRegistry,
	tabId: number,
	frameId: number,
	documentId: string
): boolean {
	return registry.get(tabId)?.get(frameId) === documentId;
}

/** Removes every remembered document when its tab or main document goes away. */
export function clearTabDocuments(
	registry: FrameDocumentRegistry,
	tabId: number
): void {
	registry.delete(tabId);
}
