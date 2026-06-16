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
	RemoteAccessHostController,
	type RemoteAccessHostStatus,
} from '@wp-playground/remote-access';

export type RemoteAccessStatus = RemoteAccessHostStatus;

const hostController = new RemoteAccessHostController({
	relayUrl: window.location.origin,
	onError(error) {
		logger.error('[RemoteAccess] Relay error:', error);
	},
});

export function getRemoteAccessStatus(): RemoteAccessStatus {
	return hostController.getStatus();
}

export function subscribeToRemoteAccessStatus(
	listener: (status: RemoteAccessStatus) => void
): () => void {
	return hostController.subscribe(listener);
}

export async function startRemoteAccess(
	playgroundClient: PlaygroundClient
): Promise<string> {
	return hostController.start(playgroundClient);
}

export async function stopRemoteAccess(): Promise<void> {
	await hostController.stop();
}

export function approveRemoteAccess(verificationCode: string): boolean {
	return hostController.approve(verificationCode);
}
