import { logger } from '@php-wasm/logger';
import type { SignalingClient } from './signaling-client';
import type {
	PlaygroundSyncTransport,
	TransportEnvelope,
	ChangesCallback,
} from '../transports';
import {
	serializeEnvelope,
	deserializeEnvelope,
	chunkMessage,
	MessageAssembler,
} from './message-chunking';

export type WebRTCTransportState =
	| 'new'
	| 'signaling'
	| 'connecting'
	| 'connected'
	| 'disconnected'
	| 'failed';

export interface WebRTCTransportOptions {
	signalingClient: SignalingClient;
	role: 'offerer' | 'answerer';
	roomCode: string;
	iceServers?: RTCIceServer[];
	onStateChange?: (state: WebRTCTransportState) => void;
}

const ICE_GATHERING_TIMEOUT_MS = 10_000;

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
	{ urls: 'stun:stun.l.google.com:19302' },
	{ urls: 'stun:stun1.l.google.com:19302' },
];

export class WebRTCTransport implements PlaygroundSyncTransport {
	private signalingClient: SignalingClient;
	private role: 'offerer' | 'answerer';
	private roomCode: string;
	private iceServers: RTCIceServer[];
	private onStateChange?: (state: WebRTCTransportState) => void;

	private pc: RTCPeerConnection | null = null;
	private dataChannel: RTCDataChannel | null = null;
	private changesCallback: ChangesCallback | null = null;
	private receiveQueue: TransportEnvelope[] = [];
	private sendQueue: Uint8Array[] = [];
	private messageId = 0;
	private assembler = new MessageAssembler();
	private state: WebRTCTransportState = 'new';

	constructor(options: WebRTCTransportOptions) {
		this.signalingClient = options.signalingClient;
		this.role = options.role;
		this.roomCode = options.roomCode;
		this.iceServers = options.iceServers ?? DEFAULT_ICE_SERVERS;
		this.onStateChange = options.onStateChange;
	}

	async connect(): Promise<void> {
		this.setState('signaling');

		this.pc = new RTCPeerConnection({
			iceServers: this.iceServers,
		});

		this.pc.addEventListener('connectionstatechange', () => {
			switch (this.pc?.connectionState) {
				case 'connected':
					this.setState('connected');
					break;
				case 'disconnected':
					this.setState('disconnected');
					break;
				case 'failed':
					this.setState('failed');
					break;
			}
		});

		if (this.role === 'offerer') {
			await this.connectAsOfferer();
		} else {
			await this.connectAsAnswerer();
		}
	}

	sendChanges(envelope: TransportEnvelope): void {
		const serialized = serializeEnvelope(envelope);
		const chunks = chunkMessage(this.messageId++, serialized);

		if (this.dataChannel && this.dataChannel.readyState === 'open') {
			for (const chunk of chunks) {
				this.dataChannel.send(chunk);
			}
		} else {
			this.sendQueue.push(...chunks);
		}
	}

	onChangesReceived(fn: ChangesCallback): void {
		this.changesCallback = fn;
		for (const envelope of this.receiveQueue) {
			fn(envelope);
		}
		this.receiveQueue = [];
	}

	close(): void {
		this.dataChannel?.close();
		this.pc?.close();
		this.dataChannel = null;
		this.pc = null;
		this.setState('disconnected');
	}

	private async connectAsOfferer(): Promise<void> {
		const dc = this.pc!.createDataChannel('sync', {
			ordered: true,
		});
		this.setupDataChannel(dc);

		const offer = await this.pc!.createOffer();
		await this.pc!.setLocalDescription(offer);
		await this.waitForIceGathering();

		await this.signalingClient.sendOffer(
			this.roomCode,
			this.pc!.localDescription!.sdp
		);

		this.setState('connecting');
		const answerSdp = await this.signalingClient.pollForAnswer(
			this.roomCode
		);
		await this.pc!.setRemoteDescription({
			type: 'answer',
			sdp: answerSdp,
		});
	}

	private async connectAsAnswerer(): Promise<void> {
		this.setState('connecting');

		const offerSdp = await this.signalingClient.pollForOffer(this.roomCode);

		await this.pc!.setRemoteDescription({
			type: 'offer',
			sdp: offerSdp,
		});

		this.pc!.addEventListener(
			'datachannel',
			(event) => {
				this.setupDataChannel(event.channel);
			},
			{ once: true }
		);

		const answer = await this.pc!.createAnswer();
		await this.pc!.setLocalDescription(answer);
		await this.waitForIceGathering();

		await this.signalingClient.sendAnswer(
			this.roomCode,
			this.pc!.localDescription!.sdp
		);
	}

	private setupDataChannel(dc: RTCDataChannel): void {
		dc.binaryType = 'arraybuffer';
		this.dataChannel = dc;

		dc.addEventListener('open', () => {
			this.setState('connected');
			this.flushQueue();
		});

		dc.addEventListener('message', (event) => {
			const data = new Uint8Array(event.data as ArrayBuffer);
			const assembled = this.assembler.addChunk(data);
			if (assembled) {
				const envelope = deserializeEnvelope(assembled);
				if (this.changesCallback) {
					this.changesCallback(envelope);
				} else {
					this.receiveQueue.push(envelope);
				}
			}
		});

		dc.addEventListener('close', () => {
			this.setState('disconnected');
		});
	}

	private flushQueue(): void {
		if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
			return;
		}
		for (const chunk of this.sendQueue) {
			this.dataChannel.send(chunk);
		}
		this.sendQueue = [];
	}

	private waitForIceGathering(): Promise<void> {
		return new Promise<void>((resolve) => {
			if (this.pc!.iceGatheringState === 'complete') {
				resolve();
				return;
			}
			const timer = setTimeout(() => {
				logger.warn(
					`[WebRTC:${this.role}] ICE gathering` +
						` timed out after ${ICE_GATHERING_TIMEOUT_MS}ms`
				);
				resolve();
			}, ICE_GATHERING_TIMEOUT_MS);
			this.pc!.addEventListener('icegatheringstatechange', () => {
				if (this.pc!.iceGatheringState === 'complete') {
					clearTimeout(timer);
					resolve();
				}
			});
		});
	}

	private setState(state: WebRTCTransportState): void {
		if (this.state !== state) {
			this.state = state;
			this.onStateChange?.(state);
		}
	}
}
