/**
 * Manages the remote-access tunnel for Personal WP.
 *
 * The host device keeps running the real Playground runtime. Remote browsers only
 * use the relay for signaling, then send WordPress HTTP requests over a direct
 * WebRTC data channel and render the responses.
 */

import { logger } from '@php-wasm/logger';
import type { PlaygroundClient } from '@wp-playground/remote';
import {
	DirectTunnelHost,
	type TunnelHostMetrics,
	type TunnelHostStatus,
} from '@wp-playground/remote-access';

let tunnelHost: DirectTunnelHost | null = null;
let currentSessionId: string | null = null;
let currentShareUrl: string | null = null;
const statusListeners = new Set<(status: RemoteAccessStatus) => void>();

export interface RemoteAccessStatus {
	isActive: boolean;
	status: TunnelHostStatus;
	shareUrl: string | null;
	sessionId: string | null;
	accessCode: string | null;
	pendingVerificationCode: string | null;
	metrics: TunnelHostMetrics | null;
}

export function getRemoteAccessStatus(): RemoteAccessStatus {
	return {
		isActive: tunnelHost !== null,
		status: tunnelHost?.getStatus() ?? 'disconnected',
		shareUrl: currentShareUrl,
		sessionId: currentSessionId,
		accessCode: tunnelHost?.getAccessCode() ?? null,
		pendingVerificationCode:
			tunnelHost?.getPendingVerificationCode() ?? null,
		metrics: tunnelHost?.getMetrics() ?? null,
	};
}

export function subscribeToRemoteAccessStatus(
	listener: (status: RemoteAccessStatus) => void
): () => void {
	statusListeners.add(listener);
	return () => {
		statusListeners.delete(listener);
	};
}

export async function startRemoteAccess(
	playgroundClient: PlaygroundClient
): Promise<string> {
	if (tunnelHost) {
		if (currentShareUrl) {
			return currentShareUrl;
		}
		throw new Error('Remote access is already starting.');
	}

	tunnelHost = new DirectTunnelHost(playgroundClient, window.location.origin);
	tunnelHost.on('statusChange', notifyListeners);
	tunnelHost.on('metricsChange', notifyListeners);
	tunnelHost.on('error', (error) => {
		logger.error('[RemoteAccess] Relay error:', error);
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

export async function stopRemoteAccess(): Promise<void> {
	if (!tunnelHost) {
		return;
	}
	await tunnelHost.stopSharing();
	tunnelHost = null;
	currentShareUrl = null;
	currentSessionId = null;
	notifyListeners();
}

export function approveRemoteAccess(verificationCode: string): boolean {
	const approved = tunnelHost?.approveRemoteAccess(verificationCode) ?? false;
	notifyListeners();
	return approved;
}

function notifyListeners() {
	const status = getRemoteAccessStatus();
	for (const listener of statusListeners) {
		listener(status);
	}
}
