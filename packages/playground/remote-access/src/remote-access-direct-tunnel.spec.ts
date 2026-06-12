import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	assembleChunkedDataChannelResponse,
	DirectTunnelGuest,
	DirectTunnelHost,
} from './remote-access-direct-tunnel';
import {
	bufferRemoteCandidate,
	createAttemptSignal,
	flushRemoteCandidates,
	formatBackupFilename,
	isAttemptCurrent,
	normalizeVerificationCode,
	readAttemptSignal,
} from './remote-access-tunnel-utils';

vi.mock('@wp-playground/blueprints', () => ({
	zipWpContent: vi.fn(),
}));

interface FakeDataChannel {
	readyState: string;
	send: ReturnType<typeof vi.fn>;
	close: ReturnType<typeof vi.fn>;
	onopen: null | (() => void);
	onclose: null | (() => void);
	onmessage: null | ((event: { data: unknown }) => void);
}

describe('remote access tunnel helpers', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
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

	it('assembles complete chunked remote access relay responses', () => {
		const response = assembleChunkedDataChannelResponse(
			{
				status: 200,
				headers: { 'Content-Type': 'text/plain' },
				totalBytes: 11,
				totalChunks: 2,
				chunks: [
					new TextEncoder().encode('hello '),
					new TextEncoder().encode('world'),
				],
			},
			'Incomplete remote access relay response'
		);

		expect(response).not.toBeInstanceOf(Error);
		expect((response as { status: number }).status).toBe(200);
		expect(
			new TextDecoder().decode((response as { body: Uint8Array }).body)
		).toBe('hello world');
	});

	it('rejects incomplete chunked remote access relay responses', () => {
		const response = assembleChunkedDataChannelResponse(
			{
				status: 200,
				headers: { 'Content-Type': 'text/plain' },
				totalBytes: 11,
				totalChunks: 2,
				chunks: [new TextEncoder().encode('hello ')],
			},
			'Incomplete remote access relay response'
		);

		expect(response).toBeInstanceOf(Error);
		expect((response as Error).message).toBe(
			'Incomplete remote access relay response'
		);
	});
});

describe('remote access direct tunnel', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('requires phone approval before marking an attempt approved', () => {
		const sentMessages: unknown[] = [];
		const host = new DirectTunnelHost(
			{} as ConstructorParameters<typeof DirectTunnelHost>[0],
			'https://example.test'
		);
		Object.assign(host as unknown as Record<string, unknown>, {
			isActive: true,
			currentAttemptId: 'attempt-1',
			dataChannel: {
				readyState: 'open',
				send: (message: string) => {
					sentMessages.push(JSON.parse(message));
				},
			},
		});

		(
			host as unknown as {
				queueDataChannelMessage: (
					data: unknown,
					attemptId: string
				) => void;
			}
		).queueDataChannelMessage(
			JSON.stringify({
				type: 'verification-code',
				code: '4 2',
				attemptId: 'attempt-1',
			}),
			'attempt-1'
		);

		expect(host.getStatus()).toBe('pending-approval');
		expect(host.getPendingVerificationCode()).toBe('42');
		expect(host.approveRemoteAccess('42')).toBe(true);
		expect(host.getStatus()).toBe('connected');
		expect(sentMessages).toContainEqual({
			type: 'approved',
			attemptId: 'attempt-1',
		});
	});

	it('records malformed host data channel messages as protocol errors', () => {
		const host = new DirectTunnelHost(
			{} as ConstructorParameters<typeof DirectTunnelHost>[0],
			'https://example.test'
		);
		Object.assign(host as unknown as Record<string, unknown>, {
			dataChannel: { readyState: 'open' },
		});

		expect(() =>
			(
				host as unknown as {
					queueDataChannelMessage: (
						data: unknown,
						attemptId: string
					) => void;
				}
			).queueDataChannelMessage('{', 'attempt-1')
		).not.toThrow();
		expect(host.getMetrics().lastError).toBe(
			'Invalid data channel message'
		);
	});

	it('reports malformed guest data channel messages without throwing', () => {
		const statuses: Array<[string, string]> = [];
		const guest = new DirectTunnelGuest({
			sessionId: 'session-1',
			relayUrl: 'https://example.test',
			guestId: 'guest-1',
			verificationCode: '42',
			onStatusChange: (status, detail) => {
				statuses.push([status, detail]);
			},
		});
		const channel: FakeDataChannel = {
			readyState: 'open',
			send: vi.fn(),
			close: vi.fn(),
			onopen: null,
			onclose: null,
			onmessage: null,
		};

		(
			guest as unknown as {
				configureDataChannel: (
					channel: FakeDataChannel,
					attemptId: string
				) => void;
			}
		).configureDataChannel(channel, 'attempt-1');

		expect(() => channel.onmessage?.({ data: '{' })).not.toThrow();
		expect(statuses).toContainEqual([
			'connecting',
			'invalid data channel message',
		]);
	});

	it('moves the host attempt to error when the data channel times out', async () => {
		vi.useFakeTimers();
		const errors: Error[] = [];
		const host = new DirectTunnelHost(
			{} as ConstructorParameters<typeof DirectTunnelHost>[0],
			'https://example.test'
		);
		host.on('error', (error) => {
			errors.push(error);
		});
		Object.assign(host as unknown as Record<string, unknown>, {
			isActive: true,
			currentAttemptId: 'attempt-1',
			dataChannel: { readyState: 'connecting' },
		});

		(
			host as unknown as {
				scheduleDataChannelOpenTimeout: (attemptId: string) => void;
			}
		).scheduleDataChannelOpenTimeout('attempt-1');
		await vi.advanceTimersByTimeAsync(8000);

		expect(host.getStatus()).toBe('error');
		expect(host.getMetrics()).toMatchObject({
			handshakeState: 'Data channel timed out',
			lastError: 'Data channel timed out',
		});
		expect(errors[0]?.message).toBe('Data channel timed out');
	});

	it('posts a retry request when the guest asks for a fresh offer', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response('{}'));
		const guest = new DirectTunnelGuest({
			sessionId: 'session-1',
			relayUrl: 'https://example.test',
			guestId: 'guest-1',
			verificationCode: '42',
			onStatusChange: vi.fn(),
		});

		await (
			guest as unknown as { requestFreshOffer: () => Promise<void> }
		).requestFreshOffer();

		expect(fetchMock).toHaveBeenCalledWith(
			'https://example.test/relay/session-1/signal',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({
					from: 'guest',
					to: 'host',
					type: 'retry-request',
					data: { guestId: 'guest-1' },
				}),
			})
		);
	});
});
