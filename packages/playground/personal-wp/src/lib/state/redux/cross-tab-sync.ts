import type { SiteMetadata } from './slice-sites';
import type { PlaygroundDispatch } from './store';
import { sitesSlice } from './slice-sites';

/**
 * Cross-tab synchronization for site metadata using BroadcastChannel.
 *
 * This module ensures that metadata changes (like backup history, days used since
 * last backup) are synchronized across all tabs that have the same site open.
 */

type MetadataUpdateMessage = {
	type: 'metadata-update';
	slug: string;
	changes: Partial<SiteMetadata>;
	senderId: string;
};

type CrossTabMessage = MetadataUpdateMessage;

const CHANNEL_NAME = 'playground-site-metadata-sync';

let channel: BroadcastChannel | null = null;
let dispatch: PlaygroundDispatch | null = null;
let senderId: string | null = null;

let isProcessingBroadcast = false;

/**
 * Initialize the cross-tab sync system.
 * Should be called once during app initialization.
 */
export function initCrossTabSync(storeDispatch: PlaygroundDispatch): void {
	if (channel) {
		return;
	}

	dispatch = storeDispatch;
	senderId = crypto.randomUUID();

	try {
		channel = new BroadcastChannel(CHANNEL_NAME);
		channel.onmessage = handleMessage;
	} catch {
		// BroadcastChannel not supported
	}
}

/**
 * Clean up the cross-tab sync system.
 */
export function destroyCrossTabSync(): void {
	if (channel) {
		channel.close();
		channel = null;
	}
	dispatch = null;
	senderId = null;
}

/**
 * Broadcast a metadata update to other tabs.
 * Called from updateSiteMetadata after the local update is applied.
 */
export function broadcastMetadataUpdate(
	slug: string,
	changes: Partial<SiteMetadata>
): void {
	if (!channel || !senderId || isProcessingBroadcast) {
		return;
	}

	const syncableChanges = filterSyncableChanges(changes);
	if (Object.keys(syncableChanges).length === 0) {
		return;
	}

	const message: MetadataUpdateMessage = {
		type: 'metadata-update',
		slug,
		changes: syncableChanges,
		senderId,
	};

	channel.postMessage(message);
}

function filterSyncableChanges(
	changes: Partial<SiteMetadata>
): Partial<SiteMetadata> {
	const syncableFields: (keyof SiteMetadata)[] = [
		'backupHistory',
		'lastAccessDate',
		'lastUsageStatsReturningVisitDate',
	];

	const filtered: Partial<SiteMetadata> = {};
	for (const field of syncableFields) {
		if (field in changes) {
			(filtered as Record<string, unknown>)[field] = changes[field];
		}
	}
	return filtered;
}

function handleMessage(event: MessageEvent<CrossTabMessage>): void {
	if (!dispatch || !senderId) {
		return;
	}

	const message = event.data;

	if (message.senderId === senderId) {
		return;
	}

	if (message.type === 'metadata-update') {
		isProcessingBroadcast = true;
		try {
			dispatch(
				sitesSlice.actions.updateSiteMetadata({
					slug: message.slug,
					metadata: message.changes,
				})
			);
		} finally {
			isProcessingBroadcast = false;
		}
	}
}

/**
 * Check if we're currently processing a broadcast.
 * Useful for preventing re-broadcasts in middleware or thunks.
 */
export function isFromBroadcast(): boolean {
	return isProcessingBroadcast;
}
