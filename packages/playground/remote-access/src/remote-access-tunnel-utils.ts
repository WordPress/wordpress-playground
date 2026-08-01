import { logger } from '@php-wasm/logger';

export interface AttemptSignalPayload<T> {
	attemptId: string;
	payload: T;
}

export function createAttemptSignal<T>(
	attemptId: string,
	payload: T
): AttemptSignalPayload<T> {
	return { attemptId, payload };
}

export function readAttemptSignal<T>(
	value: unknown
): AttemptSignalPayload<T> | null {
	if (!value || typeof value !== 'object') {
		return null;
	}
	const attemptId = (value as { attemptId?: unknown }).attemptId;
	if (typeof attemptId !== 'string' || !attemptId) {
		return null;
	}
	return {
		attemptId,
		payload: (value as { payload?: T }).payload as T,
	};
}

export function isAttemptCurrent(
	currentAttemptId: string | null,
	attemptId: string
): boolean {
	return currentAttemptId === attemptId;
}

export function normalizeVerificationCode(value: string): string {
	return value.replace(/\D+/g, '').slice(0, 2);
}

export function formatBackupFilename(siteName: string): string {
	const now = new Date();
	const date = now.toISOString().slice(0, 10);
	const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
	const sanitized = sanitizeForFilename(siteName);
	return `${sanitized || 'playground'}-backup-${date}-${time}.zip`;
}

function sanitizeForFilename(name: string): string {
	return name
		.trim()
		.replaceAll(/[^a-zA-Z0-9_-]/g, '-')
		.replaceAll(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

export function bufferRemoteCandidate(
	candidatesByAttempt: Map<string, RTCIceCandidateInit[]>,
	attemptId: string,
	candidate: RTCIceCandidateInit
): void {
	const candidates = candidatesByAttempt.get(attemptId) || [];
	candidates.push(candidate);
	candidatesByAttempt.set(attemptId, candidates);
}

export async function flushRemoteCandidates(
	candidatesByAttempt: Map<string, RTCIceCandidateInit[]>,
	attemptId: string,
	peerConnection: RTCPeerConnection,
	logPrefix: string
): Promise<void> {
	const candidates = candidatesByAttempt.get(attemptId) || [];
	candidatesByAttempt.delete(attemptId);
	for (const candidate of candidates) {
		await addIceCandidateIfCurrent(peerConnection, candidate, logPrefix);
	}
}

export async function addIceCandidateIfCurrent(
	peerConnection: RTCPeerConnection,
	candidate: RTCIceCandidateInit,
	logPrefix: string
): Promise<void> {
	try {
		await peerConnection.addIceCandidate(candidate);
	} catch (error) {
		const message = (error as Error).message;
		if (
			message.includes('Unknown ufrag') ||
			message.includes('ufrag') ||
			peerConnection.signalingState === 'closed'
		) {
			logger.warn(`${logPrefix} Ignoring stale ICE candidate:`, error);
			return;
		}
		throw error;
	}
}
