import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	bufferRemoteCandidate,
	createAttemptSignal,
	flushRemoteCandidates,
	formatBackupFilename,
	isAttemptCurrent,
	normalizeVerificationCode,
	readAttemptSignal,
} from './desktop-access-tunnel-utils';

describe('desktop access tunnel helpers', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('wraps and reads attempt-scoped signaling payloads', () => {
		const payload = { type: 'offer', sdp: 'v=0' };
		const signal = createAttemptSignal('attempt-1', payload);

		expect(signal).toEqual({ attemptId: 'attempt-1', payload });
		expect(readAttemptSignal(signal)).toEqual(signal);
		expect(readAttemptSignal({ payload })).toBeNull();
		expect(readAttemptSignal(null)).toBeNull();
	});

	it('checks current attempt ids exactly', () => {
		expect(isAttemptCurrent('attempt-1', 'attempt-1')).toBe(true);
		expect(isAttemptCurrent('attempt-1', 'attempt-2')).toBe(false);
		expect(isAttemptCurrent(null, 'attempt-1')).toBe(false);
	});

	it('normalizes two digit phone verification codes', () => {
		expect(normalizeVerificationCode('12')).toBe('12');
		expect(normalizeVerificationCode('1 2 3')).toBe('12');
		expect(normalizeVerificationCode('ab09')).toBe('09');
	});

	it('formats backup filenames with sanitized site names', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 5, 8, 9, 10, 11));

		expect(formatBackupFilename('My WordPress: Recipes!')).toBe(
			'My-WordPress-Recipes-backup-2026-06-08-091011.zip'
		);
		expect(formatBackupFilename('!!!')).toBe(
			'playground-backup-2026-06-08-091011.zip'
		);
	});

	it('buffers and flushes remote ICE candidates by attempt', async () => {
		const candidates = new Map<string, RTCIceCandidateInit[]>();
		const first = { candidate: 'candidate:1' };
		const second = { candidate: 'candidate:2' };
		const other = { candidate: 'candidate:3' };
		const peerConnection = {
			addIceCandidate: vi.fn(async () => {}),
			signalingState: 'stable',
		} as unknown as RTCPeerConnection;

		bufferRemoteCandidate(candidates, 'attempt-1', first);
		bufferRemoteCandidate(candidates, 'attempt-1', second);
		bufferRemoteCandidate(candidates, 'attempt-2', other);

		await flushRemoteCandidates(
			candidates,
			'attempt-1',
			peerConnection,
			'[test]'
		);

		expect(peerConnection.addIceCandidate).toHaveBeenCalledTimes(2);
		expect(peerConnection.addIceCandidate).toHaveBeenNthCalledWith(
			1,
			first
		);
		expect(peerConnection.addIceCandidate).toHaveBeenNthCalledWith(
			2,
			second
		);
		expect(candidates.has('attempt-1')).toBe(false);
		expect(candidates.get('attempt-2')).toEqual([other]);
	});
});
