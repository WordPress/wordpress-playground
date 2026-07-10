export type FrameScanRegistry = Map<number, Map<number, Map<string, number>>>;

/** Starts a new scan epoch for one exact frame document. */
export function advanceFrameScanEpoch(
	registry: FrameScanRegistry,
	tabId: number,
	frameId: number,
	documentId: string
): number {
	let tabScans = registry.get(tabId);
	if (!tabScans) {
		tabScans = new Map();
		registry.set(tabId, tabScans);
	}
	let frameScans = tabScans.get(frameId);
	if (!frameScans) {
		frameScans = new Map();
		tabScans.set(frameId, frameScans);
	}
	const scanEpoch = (frameScans.get(documentId) ?? 0) + 1;
	frameScans.set(documentId, scanEpoch);
	return scanEpoch;
}

/** Reports whether a scan is still the latest one for its frame document. */
export function isLatestFrameScan(
	registry: FrameScanRegistry,
	tabId: number,
	frameId: number,
	documentId: string,
	scanEpoch: number
): boolean {
	return registry.get(tabId)?.get(frameId)?.get(documentId) === scanEpoch;
}

/** Removes every scan epoch after its tab closes. */
export function clearTabScans(
	registry: FrameScanRegistry,
	tabId: number
): void {
	registry.delete(tabId);
}
