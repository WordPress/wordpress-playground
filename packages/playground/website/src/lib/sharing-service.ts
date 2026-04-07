/**
 * Sharing Service - manages the TunnelHost instance for peer-to-peer sharing.
 *
 * This service keeps the sharing session alive even when the modal is closed.
 * The TunnelHost instance is stored here rather than in Redux because it's a
 * complex object with methods and callbacks that doesn't serialize well.
 */

import { logger } from '@php-wasm/logger';
import type { PlaygroundClient } from '@wp-playground/remote';
import { TunnelHost, type TunnelHostStatus } from './relay-server';

let tunnelHost: TunnelHost | null = null;
let currentSessionId: string | null = null;
let currentShareUrl: string | null = null;
const statusListeners: Set<(status: SharingStatus) => void> = new Set();

export interface SharingStatus {
	isActive: boolean;
	status: TunnelHostStatus;
	shareUrl: string | null;
	sessionId: string | null;
}

function notifyListeners() {
	const status = getSharingStatus();
	statusListeners.forEach((listener) => listener(status));
}

/**
 * Get the current sharing status.
 */
export function getSharingStatus(): SharingStatus {
	return {
		isActive: tunnelHost !== null,
		status: tunnelHost?.getStatus() ?? 'disconnected',
		shareUrl: currentShareUrl,
		sessionId: currentSessionId,
	};
}

/**
 * Subscribe to sharing status changes.
 */
export function subscribeToSharingStatus(
	listener: (status: SharingStatus) => void
): () => void {
	statusListeners.add(listener);
	return () => statusListeners.delete(listener);
}

/**
 * Start a sharing session.
 */
export async function startSharing(
	playgroundClient: PlaygroundClient
): Promise<string> {
	if (tunnelHost) {
		// Already sharing - return existing URL
		if (currentShareUrl) {
			return currentShareUrl;
		}
		throw new Error('Already sharing but no URL available');
	}

	const relayUrl = window.location.origin;
	tunnelHost = new TunnelHost(playgroundClient, relayUrl);

	tunnelHost.on('statusChange', () => {
		notifyListeners();
	});

	tunnelHost.on('error', (error) => {
		logger.error('[SharingService] Error:', error);
		notifyListeners();
	});

	try {
		currentShareUrl = await tunnelHost.startSharing();
		currentSessionId = tunnelHost.getSessionId();
		notifyListeners();
		return currentShareUrl;
	} catch (error) {
		tunnelHost = null;
		currentShareUrl = null;
		currentSessionId = null;
		notifyListeners();
		throw error;
	}
}

/**
 * Stop the current sharing session.
 */
export async function stopSharing(): Promise<void> {
	if (tunnelHost) {
		await tunnelHost.stopSharing();
		tunnelHost = null;
		currentShareUrl = null;
		currentSessionId = null;
		notifyListeners();
	}
}

/**
 * Check if currently sharing.
 */
export function isSharing(): boolean {
	return tunnelHost !== null;
}

/**
 * Get the current share URL.
 */
export function getShareUrl(): string | null {
	return currentShareUrl;
}

/**
 * Get the TunnelHost instance (for advanced use).
 */
export function getTunnelHost(): TunnelHost | null {
	return tunnelHost;
}
