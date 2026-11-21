import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	assembleChunkedDataChannelResponse,
	DirectTunnelGuest,
	DirectTunnelHost,
} from './remote-access-direct-tunnel';
import {
	bufferRemoteCandidate,
	buildHostTokenHeaders,
	createAttemptSignal,
	flushRemoteCandidates,
	formatBackupFilename,
	HOST_TOKEN_HEADER,
	isAttemptCurrent,
	normalizeVerificationCode,
	readAttemptSignal,
} from './remote-access-tunnel-utils';
import { zipWpContent } from '@wp-playground/blueprints';

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

	it('builds host token headers only after the relay issues a token', () => {
		expect(buildHostTokenHeaders(null)).toEqual({});
		expect(buildHostTokenHeaders('host-token-1')).toEqual({
			[HOST_TOKEN_HEADER]: 'host-token-1',
		});
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

	it('rejects chunked remote access relay responses with mismatched byte counts', () => {
		const response = assembleChunkedDataChannelResponse(
			{
				status: 200,
				headers: { 'Content-Type': 'text/plain' },
				totalBytes: 4,
				totalChunks: 2,
				chunks: [
					new TextEncoder().encode('hello '),
					new TextEncoder().encode('world'),
				],
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
			sessionId: 'session-1',
			hostToken: 'host-token-1',
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
			'https://example.test/relay.php?action=signal&sessionId=session-1',
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

	it('surfaces relay errors when posting a retry request', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ error: 'Invalid signal' }), {
				status: 400,
				headers: {
					'Content-Type': 'application/json',
				},
			})
		);
		const guest = new DirectTunnelGuest({
			sessionId: 'session-1',
			relayUrl: 'https://example.test',
			guestId: 'guest-1',
			verificationCode: '42',
			onStatusChange: vi.fn(),
		});

		await expect(
			(
				guest as unknown as { requestFreshOffer: () => Promise<void> }
			).requestFreshOffer()
		).rejects.toThrow('Signal post failed: 400: Invalid signal');
	});

	it('surfaces relay denial when a host signal lacks a host token', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ error: 'Missing host token' }), {
				status: 401,
				headers: {
					'Content-Type': 'application/json',
				},
			})
		);
		const host = new DirectTunnelHost(
			{} as ConstructorParameters<typeof DirectTunnelHost>[0],
			'https://example.test'
		);
		Object.assign(host as unknown as Record<string, unknown>, {
			sessionId: 'session-1',
			hostToken: null,
		});

		await expect(
			(
				host as unknown as {
					postSignal: (
						to: 'guest',
						type: 'offer',
						data: unknown
					) => Promise<void>;
				}
			).postSignal('guest', 'offer', {
				attemptId: 'attempt-1',
				payload: { type: 'offer', sdp: 'v=0' },
			})
		).rejects.toThrow('Signal post failed: 401: Missing host token');
	});

	/*
	 * The relay only accepts host-side signaling from the token holder, which
	 * is what ties the host's approval to the device that showed the code. A
	 * host-side call that forgets the header gets rejected, so every one of
	 * them has to carry it.
	 */
	it('sends the host token on every host-side relay call', async () => {
		const calls: Array<{ url: string; headers: Record<string, string> }> =
			[];
		let releasePoll = () => {};
		const pendingPoll = new Promise<Response>((resolve) => {
			releasePoll = () =>
				resolve(
					new Response(
						JSON.stringify({
							messages: [],
							cursor: 0,
							hostAlive: true,
						})
					)
				);
		});
		vi.spyOn(globalThis, 'fetch').mockImplementation(
			async (input, init) => {
				const url = String(input);
				calls.push({
					url,
					headers: { ...((init?.headers ?? {}) as object) },
				});
				if (url.includes('action=session')) {
					return new Response(
						JSON.stringify({
							sessionId: 'session-1',
							shareUrl: 'https://example.test/?share=session-1',
							accessCode: '123-456',
							hostToken: 'host-token-1',
						})
					);
				}
				// Park the long poll so its loop cannot spin during the test.
				if (url.includes('to=host')) {
					return pendingPoll;
				}
				return new Response('{}');
			}
		);

		const host = new DirectTunnelHost(
			{} as ConstructorParameters<typeof DirectTunnelHost>[0],
			'https://example.test'
		);
		await host.startSharing();
		await vi.waitFor(() =>
			expect(calls.some((call) => call.url.includes('to=host'))).toBe(
				true
			)
		);
		await (
			host as unknown as {
				postSignal: (
					to: 'guest',
					type: 'offer',
					data: unknown
				) => Promise<void>;
			}
		).postSignal('guest', 'offer', {
			attemptId: 'attempt-1',
			payload: { type: 'offer', sdp: 'v=0' },
		});
		await host.stopSharing();
		releasePoll();

		const hostSideCalls = calls.filter(
			(call) => !call.url.includes('action=session')
		);
		expect(hostSideCalls.map((call) => call.url)).toEqual(
			expect.arrayContaining([
				expect.stringContaining('to=host'),
				expect.stringContaining('action=signal'),
				expect.stringContaining('action=close'),
			])
		);
		for (const call of hostSideCalls) {
			expect(call.headers['X-Playground-Host-Token']).toBe(
				'host-token-1'
			);
		}
	});

	/*
	 * A guest can ask the host for a fresh offer without approval. Work that
	 * began for the approved viewer must not complete on that new channel.
	 */
	describe('when an unapproved attempt replaces the approved channel', () => {
		function createDeferred<T>() {
			let resolve!: (value: T) => void;
			const promise = new Promise<T>((res) => {
				resolve = res;
			});
			return { promise, resolve };
		}

		function createOpenChannel() {
			const sent: Array<Record<string, unknown>> = [];
			const channel = {
				readyState: 'open',
				bufferedAmount: 0,
				send: vi.fn((message: string) => {
					sent.push(JSON.parse(message));
				}),
				close: vi.fn(() => {
					channel.readyState = 'closed';
				}),
			};
			return { channel, sent };
		}

		type HostInternals = {
			currentAttemptId: string | null;
			queueDataChannelMessage: (data: unknown, attemptId: string) => void;
			handleSignals: (messages: unknown[]) => Promise<void>;
		};

		function createApprovedHost(
			client: Record<string, unknown>,
			replacementChannel: ReturnType<typeof createOpenChannel>['channel']
		) {
			vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
			vi.stubGlobal(
				'RTCPeerConnection',
				class {
					localDescription = { type: 'offer', sdp: 'v=0' };
					createDataChannel() {
						return replacementChannel;
					}
					async createOffer() {
						return this.localDescription;
					}
					async setLocalDescription() {}
					close() {}
				}
			);
			const approved = createOpenChannel();
			const host = new DirectTunnelHost(
				client as ConstructorParameters<typeof DirectTunnelHost>[0],
				'https://example.test'
			);
			Object.assign(host as unknown as Record<string, unknown>, {
				isActive: true,
				sessionId: 'session-1',
				hostToken: 'host-token-1',
				currentAttemptId: 'attempt-1',
				approvedAttemptId: 'attempt-1',
				dataChannel: approved.channel,
			});
			return {
				host: host as unknown as HostInternals,
				approved,
			};
		}

		async function retryFromUnapprovedGuest(host: HostInternals) {
			await host.handleSignals([
				{
					seq: 1,
					from: 'guest',
					to: 'host',
					type: 'retry-request',
					data: { guestId: 'guest-2' },
				},
			]);
			expect(host.currentAttemptId).not.toBe('attempt-1');
			return host.currentAttemptId!;
		}

		afterEach(() => {
			vi.unstubAllGlobals();
		});

		it('does not deliver a pending HTTP response to the new channel', async () => {
			const phpResponse = createDeferred<unknown>();
			const replacement = createOpenChannel();
			const { host, approved } = createApprovedHost(
				{ request: vi.fn(() => phpResponse.promise) },
				replacement.channel
			);

			host.queueDataChannelMessage(
				JSON.stringify({
					type: 'request',
					requestId: 'request-1',
					attemptId: 'attempt-1',
					method: 'GET',
					path: '/wp-admin/',
					headers: {},
				}),
				'attempt-1'
			);
			const newAttemptId = await retryFromUnapprovedGuest(host);
			phpResponse.resolve({
				httpStatusCode: 200,
				headers: {},
				bytes: new TextEncoder().encode('approved viewer only'),
			});
			await vi.waitFor(() =>
				expect(
					(host as unknown as { isProcessingRequest: boolean })
						.isProcessingRequest
				).toBe(false)
			);

			expect(replacement.sent).toEqual([]);
			expect(approved.sent).toEqual([]);

			host.queueDataChannelMessage(
				JSON.stringify({
					type: 'request',
					requestId: 'request-2',
					attemptId: newAttemptId,
					method: 'GET',
					path: '/wp-admin/',
					headers: {},
				}),
				newAttemptId
			);
			expect(replacement.sent).toEqual([
				expect.objectContaining({
					type: 'response',
					requestId: 'request-2',
					status: 403,
				}),
			]);
		});

		it('does not deliver a pending backup to the new channel', async () => {
			const backup = createDeferred<Uint8Array>();
			vi.mocked(zipWpContent).mockReturnValue(
				backup.promise as ReturnType<typeof zipWpContent>
			);
			const replacement = createOpenChannel();
			const { host, approved } = createApprovedHost(
				{ run: vi.fn(async () => ({ text: 'Site' })) },
				replacement.channel
			);

			host.queueDataChannelMessage(
				JSON.stringify({
					type: 'backup-request',
					requestId: 'backup-1',
					attemptId: 'attempt-1',
				}),
				'attempt-1'
			);
			await vi.waitFor(() => expect(zipWpContent).toHaveBeenCalled());
			const newAttemptId = await retryFromUnapprovedGuest(host);
			backup.resolve(new Uint8Array(40 * 1024));
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(replacement.sent).toEqual([]);
			expect(approved.sent).toEqual([]);

			host.queueDataChannelMessage(
				JSON.stringify({
					type: 'backup-request',
					requestId: 'backup-2',
					attemptId: newAttemptId,
				}),
				newAttemptId
			);
			expect(replacement.sent).toEqual([
				{
					type: 'backup-error',
					requestId: 'backup-2',
					error: 'Waiting for approval on the host device.',
				},
			]);
		});
	});
});
