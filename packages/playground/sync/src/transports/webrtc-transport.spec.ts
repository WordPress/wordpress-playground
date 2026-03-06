import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebRTCTransport } from './webrtc-transport';
import type { WebRTCTransportState } from './webrtc-transport';
import type { SignalingClient } from './signaling-client';
import type { TransportEnvelope } from '../transports';

// --- Mocks ---

class MockDataChannel {
	readyState = 'connecting';
	binaryType = 'blob';
	ordered = true;
	private listeners = new Map<
		string,
		Set<EventListenerOrEventListenerObject>
	>();

	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: { once?: boolean }
	) {
		if (!this.listeners.has(type)) {
			this.listeners.set(type, new Set());
		}
		if (options?.once) {
			const original = listener;
			const wrapper = ((event: Event) => {
				this.listeners.get(type)?.delete(wrapper);
				if (typeof original === 'function') {
					original(event);
				} else {
					original.handleEvent(event);
				}
			}) as EventListener;
			this.listeners.get(type)!.add(wrapper);
		} else {
			this.listeners.get(type)!.add(listener);
		}
	}

	removeEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject
	) {
		this.listeners.get(type)?.delete(listener);
	}

	send = vi.fn();
	close = vi.fn();

	// Test helpers
	emit(type: string, event?: unknown) {
		for (const listener of this.listeners.get(type) ?? []) {
			if (typeof listener === 'function') {
				listener(event as Event);
			} else {
				listener.handleEvent(event as Event);
			}
		}
	}

	simulateOpen() {
		this.readyState = 'open';
		this.emit('open');
	}
}

class MockPeerConnection {
	connectionState = 'new';
	iceGatheringState = 'new';
	localDescription: { type: string; sdp: string } | null = null;
	private listeners = new Map<
		string,
		Set<EventListenerOrEventListenerObject>
	>();
	createdChannel: MockDataChannel | null = null;

	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: { once?: boolean }
	) {
		if (!this.listeners.has(type)) {
			this.listeners.set(type, new Set());
		}
		if (options?.once) {
			const original = listener;
			const wrapper = ((event: Event) => {
				this.listeners.get(type)?.delete(wrapper);
				if (typeof original === 'function') {
					original(event);
				} else {
					original.handleEvent(event);
				}
			}) as EventListener;
			this.listeners.get(type)!.add(wrapper);
		} else {
			this.listeners.get(type)!.add(listener);
		}
	}

	removeEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject
	) {
		this.listeners.get(type)?.delete(listener);
	}

	createDataChannel(_label: string, _options?: unknown) {
		this.createdChannel = new MockDataChannel();
		return this.createdChannel;
	}

	async createOffer() {
		return { type: 'offer', sdp: 'mock-offer-sdp' };
	}

	async createAnswer() {
		return { type: 'answer', sdp: 'mock-answer-sdp' };
	}

	async setLocalDescription(desc: { type: string; sdp: string }) {
		this.localDescription = desc;
		// Simulate ICE gathering completing immediately
		this.iceGatheringState = 'complete';
		this.emit('icegatheringstatechange');
	}

	async setRemoteDescription(_desc: { type: string; sdp: string }) {
		// no-op for mock
	}

	close = vi.fn();

	// Test helpers
	emit(type: string, event?: unknown) {
		for (const listener of this.listeners.get(type) ?? []) {
			if (typeof listener === 'function') {
				listener(event as Event);
			} else {
				listener.handleEvent(event as Event);
			}
		}
	}

	simulateDataChannelEvent(channel: MockDataChannel) {
		this.emit('datachannel', { channel });
	}
}

function createMockSignalingClient(
	overrides: Partial<SignalingClient> = {}
): SignalingClient {
	return {
		createRoom: vi.fn().mockResolvedValue('TEST01'),
		sendOffer: vi.fn().mockResolvedValue(undefined),
		sendAnswer: vi.fn().mockResolvedValue(undefined),
		pollForOffer: vi.fn().mockResolvedValue('remote-offer-sdp'),
		pollForAnswer: vi.fn().mockResolvedValue('remote-answer-sdp'),
		...overrides,
	} as unknown as SignalingClient;
}

describe('WebRTCTransport', () => {
	let originalRTCPeerConnection: typeof globalThis.RTCPeerConnection;
	let lastMockPC: MockPeerConnection;

	beforeEach(() => {
		originalRTCPeerConnection = globalThis.RTCPeerConnection;
		(globalThis as unknown as Record<string, unknown>).RTCPeerConnection =
			vi.fn().mockImplementation(() => {
				lastMockPC = new MockPeerConnection();
				return lastMockPC;
			});
	});

	afterEach(() => {
		(globalThis as unknown as Record<string, unknown>).RTCPeerConnection =
			originalRTCPeerConnection;
		vi.restoreAllMocks();
	});

	describe('offerer flow', () => {
		it('should create offer, send via signaling, poll for answer', async () => {
			const signaling = createMockSignalingClient();
			const states: WebRTCTransportState[] = [];
			const transport = new WebRTCTransport({
				signalingClient: signaling,
				role: 'offerer',
				roomCode: 'ROOM1',
				onStateChange: (s) => states.push(s),
			});

			await transport.connect();

			expect(signaling.sendOffer).toHaveBeenCalledWith(
				'ROOM1',
				'mock-offer-sdp'
			);
			expect(signaling.pollForAnswer).toHaveBeenCalledWith('ROOM1');
			expect(states).toContain('signaling');
			expect(states).toContain('connecting');
		});

		it('should flush queued messages when DataChannel opens', async () => {
			const signaling = createMockSignalingClient();
			const transport = new WebRTCTransport({
				signalingClient: signaling,
				role: 'offerer',
				roomCode: 'ROOM1',
			});

			await transport.connect();

			const envelope: TransportEnvelope = {
				sql: [
					{
						type: 'sql',
						subtype: 'replay',
						query: 'INSERT INTO test VALUES (1)',
					},
				],
				fs: [],
			};

			// Queue a message before the channel opens
			transport.sendChanges(envelope);

			const dc = lastMockPC.createdChannel!;
			expect(dc.send).not.toHaveBeenCalled();

			// Open the channel — queue should flush
			dc.simulateOpen();
			expect(dc.send).toHaveBeenCalled();
		});
	});

	describe('answerer flow', () => {
		it('should poll for offer, create answer, send via signaling', async () => {
			const signaling = createMockSignalingClient();
			const states: WebRTCTransportState[] = [];
			const transport = new WebRTCTransport({
				signalingClient: signaling,
				role: 'answerer',
				roomCode: 'ROOM1',
				onStateChange: (s) => states.push(s),
			});

			// The answerer flow will call pollForOffer, then
			// setRemoteDescription, then wait for datachannel event.
			// We need to simulate the PC emitting the datachannel event.
			const connectPromise = transport.connect();

			// Wait a tick for the async operations to proceed
			await new Promise((r) => setTimeout(r, 0));

			// Simulate the peer connection delivering a data channel
			const remoteDC = new MockDataChannel();
			lastMockPC.simulateDataChannelEvent(remoteDC);

			await connectPromise;

			expect(signaling.pollForOffer).toHaveBeenCalledWith('ROOM1');
			expect(signaling.sendAnswer).toHaveBeenCalledWith(
				'ROOM1',
				'mock-answer-sdp'
			);
			expect(states).toContain('signaling');
			expect(states).toContain('connecting');
		});
	});

	describe('message handling', () => {
		it('should deliver received messages via onChangesReceived', async () => {
			const signaling = createMockSignalingClient();
			const transport = new WebRTCTransport({
				signalingClient: signaling,
				role: 'offerer',
				roomCode: 'ROOM1',
			});

			const received: TransportEnvelope[] = [];
			transport.onChangesReceived((env) => received.push(env));

			await transport.connect();
			const dc = lastMockPC.createdChannel!;
			dc.simulateOpen();

			// Simulate the other side sending a message
			// We need to create valid chunked data
			const { serializeEnvelope, chunkMessage } =
				await import('./message-chunking');
			const envelope: TransportEnvelope = {
				sql: [
					{
						type: 'sql',
						subtype: 'replay',
						query: 'SELECT 1',
					},
				],
				fs: [],
			};
			const serialized = serializeEnvelope(envelope);
			const chunks = chunkMessage(0, serialized);

			for (const chunk of chunks) {
				dc.emit('message', { data: chunk.buffer });
			}

			expect(received).toHaveLength(1);
			expect(received[0].sql[0]).toEqual(envelope.sql[0]);
		});
	});

	describe('state transitions', () => {
		it('should report disconnected on close', async () => {
			const signaling = createMockSignalingClient();
			const states: WebRTCTransportState[] = [];
			const transport = new WebRTCTransport({
				signalingClient: signaling,
				role: 'offerer',
				roomCode: 'ROOM1',
				onStateChange: (s) => states.push(s),
			});

			await transport.connect();
			transport.close();
			expect(states).toContain('disconnected');
		});

		it('should report failed on PC connection failure', async () => {
			const signaling = createMockSignalingClient();
			const states: WebRTCTransportState[] = [];
			const transport = new WebRTCTransport({
				signalingClient: signaling,
				role: 'offerer',
				roomCode: 'ROOM1',
				onStateChange: (s) => states.push(s),
			});

			await transport.connect();
			lastMockPC.connectionState = 'failed';
			lastMockPC.emit('connectionstatechange');
			expect(states).toContain('failed');
		});
	});
});
