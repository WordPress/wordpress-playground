/**
 * Manages the desktop-access tunnel for Personal WP.
 *
 * The phone keeps running the real Playground runtime. Desktop browsers only
 * send HTTP requests through the relay and render the responses.
 */

import { logger } from '@php-wasm/logger';
import type { PlaygroundClient } from '@wp-playground/remote';
import {
	DirectTunnelHost,
	type TunnelHostMetrics,
	type TunnelHostStatus,
} from './desktop-access-direct-tunnel';

let tunnelHost: DirectTunnelHost | null = null;
let currentSessionId: string | null = null;
let currentShareUrl: string | null = null;
const statusListeners = new Set<(status: DesktopAccessStatus) => void>();

export interface DesktopAccessStatus {
	isActive: boolean;
	status: TunnelHostStatus;
	shareUrl: string | null;
	sessionId: string | null;
	accessCode: string | null;
	metrics: TunnelHostMetrics | null;
}

export function getDesktopAccessStatus(): DesktopAccessStatus {
	return {
		isActive: tunnelHost !== null,
		status: tunnelHost?.getStatus() ?? 'disconnected',
		shareUrl: currentShareUrl,
		sessionId: currentSessionId,
		accessCode: tunnelHost?.getAccessCode() ?? null,
		metrics: tunnelHost?.getMetrics() ?? null,
	};
}

export function subscribeToDesktopAccessStatus(
	listener: (status: DesktopAccessStatus) => void
): () => void {
	statusListeners.add(listener);
	return () => {
		statusListeners.delete(listener);
	};
}

export async function startDesktopAccess(
	playgroundClient: PlaygroundClient
): Promise<string> {
	if (tunnelHost) {
		if (currentShareUrl) {
			return currentShareUrl;
		}
		throw new Error('Desktop access is already starting.');
	}

	tunnelHost = new DirectTunnelHost(playgroundClient, window.location.origin);
	tunnelHost.on('statusChange', notifyListeners);
	tunnelHost.on('metricsChange', notifyListeners);
	tunnelHost.on('error', (error) => {
		logger.error('[DesktopAccess] Relay error:', error);
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

export async function stopDesktopAccess(): Promise<void> {
	if (!tunnelHost) {
		return;
	}
	await tunnelHost.stopSharing();
	tunnelHost = null;
	currentShareUrl = null;
	currentSessionId = null;
	notifyListeners();
}

export function approveDesktopAccess(): void {
	tunnelHost?.approveDesktopAccess();
	notifyListeners();
}

function notifyListeners() {
	const status = getDesktopAccessStatus();
	for (const listener of statusListeners) {
		listener(status);
	}
}
