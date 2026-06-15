import { logger } from '@php-wasm/logger';
import type { HTTPMethod } from '@php-wasm/universal';
import { zipWpContent } from '@wp-playground/blueprints';
import {
	addIceCandidateIfCurrent,
	bufferRemoteCandidate,
	createAttemptSignal,
	flushRemoteCandidates,
	formatBackupFilename,
	isAttemptCurrent,
	normalizeVerificationCode,
	readAttemptSignal,
} from './remote-access-tunnel-utils';
import { buildRemoteAccessRelayEndpointUrl } from './connect-code';
import type { RemoteAccessHostClient } from './types';

export type TunnelHostStatus =
	| 'disconnected'
	| 'connecting'
	| 'pending-approval'
	| 'connected'
	| 'error';

export interface TunnelHostMetrics {
	received: number;
	pending: number;
	processing: number;
	completed: number;
	failed: number;
	handshakeAttempts: number;
	localCandidates: number;
	remoteCandidates: number;
	handshakeState: string;
	lastMethod: string | null;
	lastPath: string | null;
	lastStatus: number | null;
	lastError: string | null;
}

export interface TunnelHostEvents {
	statusChange: (status: TunnelHostStatus) => void;
	metricsChange: (metrics: TunnelHostMetrics) => void;
	error: (error: Error) => void;
}

interface CreateSessionResponse {
	sessionId: string;
	shareUrl: string;
	accessCode: string;
}

interface TunnelRequest {
	requestId: string;
	method: string;
	path: string;
	headers: Record<string, string>;
	body?: Uint8Array;
}

export interface TunnelResponse {
	requestId: string;
	status: number;
	headers: Record<string, string>;
	cookies?: string[];
	body: Uint8Array;
}

type PeerRole = 'host' | 'guest';

type SignalType =
	| 'offer'
	| 'answer'
	| 'candidate'
	| 'heartbeat'
	| 'retry-request';

interface SignalMessage {
	seq: number;
	from: PeerRole;
	to: PeerRole;
	type: SignalType;
	data: unknown;
}

interface SignalPollResponse {
	messages: SignalMessage[];
	cursor: number;
	hostAlive: boolean;
}

interface DataChannelRequest extends Omit<TunnelRequest, 'body'> {
	type: 'request';
	attemptId: string;
	body?: string;
}

interface DataChannelRequestStart extends Omit<TunnelRequest, 'body'> {
	type: 'request-start';
	attemptId: string;
	totalBytes: number;
	totalChunks: number;
}

interface DataChannelRequestChunk {
	type: 'request-chunk';
	requestId: string;
	attemptId: string;
	index: number;
	body: string;
}

interface DataChannelRequestComplete {
	type: 'request-complete';
	requestId: string;
	attemptId: string;
}

interface DataChannelResponse extends Omit<TunnelResponse, 'body'> {
	type: 'response';
	body: string;
}

interface DataChannelResponseStart {
	type: 'response-start';
	requestId: string;
	status: number;
	headers: Record<string, string>;
	cookies?: string[];
	totalBytes: number;
	totalChunks: number;
}

interface DataChannelResponseChunk {
	type: 'response-chunk';
	requestId: string;
	index: number;
	body: string;
}

interface DataChannelResponseComplete {
	type: 'response-complete';
	requestId: string;
}

interface DataChannelBackupRequest {
	type: 'backup-request';
	requestId: string;
	attemptId: string;
}

interface DataChannelBackupStart {
	type: 'backup-start';
	requestId: string;
	filename: string;
	totalBytes: number;
	totalChunks: number;
}

interface DataChannelBackupChunk {
	type: 'backup-chunk';
	requestId: string;
	index: number;
	body: string;
}

interface DataChannelBackupComplete {
	type: 'backup-complete';
	requestId: string;
}

interface DataChannelBackupError {
	type: 'backup-error';
	requestId: string;
	error: string;
}

type DataChannelControlMessage =
	| { type: 'approval-required'; attemptId: string }
	| { type: 'verification-code'; code: string; attemptId: string }
	| { type: 'approved'; attemptId: string };

type DataChannelHostMessage =
	| DataChannelRequest
	| DataChannelRequestStart
	| DataChannelRequestChunk
	| DataChannelRequestComplete
	| DataChannelBackupRequest
	| DataChannelControlMessage;

type DataChannelGuestMessage =
	| DataChannelResponse
	| DataChannelResponseStart
	| DataChannelResponseChunk
	| DataChannelResponseComplete
	| DataChannelBackupStart
	| DataChannelBackupChunk
	| DataChannelBackupComplete
	| DataChannelBackupError
	| DataChannelControlMessage;

const DATA_CHANNEL_CHUNK_SIZE = 16 * 1024;
const DATA_CHANNEL_OPEN_TIMEOUT_MS = 8000;
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
	{ urls: 'stun:stun.cloudflare.com:3478' },
	{ urls: 'stun:stun.l.google.com:19302' },
	{ urls: 'stun:stun1.l.google.com:19302' },
];

/**
 * Convert a Uint8Array to a base64 string (browser-compatible).
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

function base64ToUint8Array(value: string): Uint8Array {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

function parseDataChannelMessage<T>(
	data: unknown,
	logPrefix: string
): T | null {
	if (typeof data !== 'string') {
		return null;
	}
	try {
		return JSON.parse(data) as T;
	} catch (error) {
		logger.warn(`${logPrefix} Invalid data channel message:`, error);
		return null;
	}
}

export function assembleChunkedDataChannelResponse(
	pending: {
		status?: number;
		headers?: Record<string, string>;
		cookies?: string[];
		totalBytes?: number;
		totalChunks?: number;
		chunks?: Uint8Array[];
	},
	errorMessage: string
): TunnelResponse | Error {
	if (
		pending.status === undefined ||
		!pending.headers ||
		pending.totalBytes === undefined ||
		pending.totalChunks === undefined ||
		!pending.chunks ||
		pending.chunks.length !== pending.totalChunks
	) {
		return new Error(errorMessage);
	}
	const bytes = new Uint8Array(pending.totalBytes);
	let offset = 0;
	for (const chunk of pending.chunks) {
		if (!chunk) {
			return new Error(errorMessage);
		}
		bytes.set(chunk, offset);
		offset += chunk.length;
	}
	return {
		requestId: '',
		status: pending.status,
		headers: pending.headers,
		cookies: pending.cookies,
		body: bytes,
	};
}

function assembleDataChannelChunks(
	pending: {
		totalBytes: number;
		totalChunks: number;
		chunks: Uint8Array[];
	},
	errorMessage: string
): Uint8Array | Error {
	if (
		pending.chunks.length !== pending.totalChunks ||
		pending.totalBytes < 0
	) {
		return new Error(errorMessage);
	}
	const bytes = new Uint8Array(pending.totalBytes);
	let offset = 0;
	for (const chunk of pending.chunks) {
		if (!chunk) {
			return new Error(errorMessage);
		}
		bytes.set(chunk, offset);
		offset += chunk.length;
	}
	if (offset !== pending.totalBytes) {
		return new Error(errorMessage);
	}
	return bytes;
}

function getHeaderValues(
	headers: Record<string, string | string[]>,
	name: string
): string[] | undefined {
	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() !== name) {
			continue;
		}
		return Array.isArray(value) ? value : [value];
	}
	return undefined;
}

function isChunkedRequestMessage(
	message: DataChannelHostMessage
): message is
	| DataChannelRequestStart
	| DataChannelRequestChunk
	| DataChannelRequestComplete {
	return (
		message.type === 'request-start' ||
		message.type === 'request-chunk' ||
		message.type === 'request-complete'
	);
}

function createPeerConnection(): RTCPeerConnection {
	return new RTCPeerConnection({
		iceServers: DEFAULT_ICE_SERVERS,
	});
}

function isSessionDescription(value: unknown): RTCSessionDescriptionInit {
	if (
		!value ||
		typeof value !== 'object' ||
		typeof (value as { type?: unknown }).type !== 'string'
	) {
		throw new Error('Invalid WebRTC session description');
	}
	return value as RTCSessionDescriptionInit;
}

function isIceCandidate(value: unknown): RTCIceCandidateInit {
	if (!value || typeof value !== 'object') {
		throw new Error('Invalid WebRTC ICE candidate');
	}
	return value as RTCIceCandidateInit;
}

function serializeSessionDescription(
	description: RTCSessionDescription | RTCSessionDescriptionInit | null
): RTCSessionDescriptionInit {
	if (!description) {
		throw new Error('Missing WebRTC session description');
	}
	return {
		type: description.type,
		sdp: description.sdp,
	};
}

function serializeIceCandidate(
	candidate: RTCIceCandidate
): RTCIceCandidateInit {
	return {
		candidate: candidate.candidate,
		sdpMid: candidate.sdpMid,
		sdpMLineIndex: candidate.sdpMLineIndex,
		usernameFragment: candidate.usernameFragment ?? undefined,
	};
}

async function getWordPressSiteName(
	playgroundClient: RemoteAccessHostClient
): Promise<string | null> {
	try {
		const response = await playgroundClient.run({
			code: `<?php
				require_once '/wordpress/wp-load.php';
				$name = get_option('blogname', 'WordPress');
				echo html_entity_decode($name, ENT_QUOTES, 'UTF-8');
			`,
		});
		const name = response.text.trim();
		return name || null;
	} catch (error) {
		logger.debug('[DirectTunnelHost] Could not retrieve site name:', error);
		return null;
	}
}

function isDataChannelControlMessage(value: {
	type: string;
}): value is DataChannelControlMessage {
	return (
		value.type === 'approval-required' ||
		value.type === 'verification-code' ||
		value.type === 'approved'
	);
}

function shouldShowIceCandidateState(currentState: string): boolean {
	return (
		currentState === 'Waiting' ||
		currentState === 'Creating offer' ||
		currentState === 'Setting local offer' ||
		currentState === 'Offer sent' ||
		currentState === 'Answer received' ||
		currentState === 'Remote answer set' ||
		currentState === 'Sending ICE candidate' ||
		currentState === 'Remote ICE candidate received' ||
		currentState === 'Reconnecting'
	);
}

/**
 * Host-side direct tunnel. The relay is only used to exchange WebRTC
 * signaling messages; WordPress HTTP requests are handled over the data channel.
 */
export class DirectTunnelHost {
	private readonly playgroundClient: RemoteAccessHostClient;
	private readonly relayUrl: string;
	private peerConnection: RTCPeerConnection | null = null;
	private dataChannel: RTCDataChannel | null = null;
	private sessionId: string | null = null;
	private shareUrl: string | null = null;
	private accessCode: string | null = null;
	private isActive = false;
	private signalCursor = 0;
	private status: TunnelHostStatus = 'disconnected';
	private listeners: Partial<{
		[K in keyof TunnelHostEvents]: Set<TunnelHostEvents[K]>;
	}> = {};
	private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
	private dataChannelOpenTimeout: ReturnType<typeof setTimeout> | null = null;
	private isCreatingOffer = false;
	private currentAttemptId: string | null = null;
	private approvedAttemptId: string | null = null;
	private pendingVerificationCode: string | null = null;
	private pendingRemoteCandidates = new Map<string, RTCIceCandidateInit[]>();
	private pendingChunkedRequests = new Map<
		string,
		{
			method: string;
			path: string;
			headers: Record<string, string>;
			totalBytes: number;
			totalChunks: number;
			chunks: Uint8Array[];
		}
	>();
	private requestQueue: DataChannelRequest[] = [];
	private isProcessingRequest = false;
	private metrics: TunnelHostMetrics = {
		received: 0,
		pending: 0,
		processing: 0,
		completed: 0,
		failed: 0,
		handshakeAttempts: 0,
		localCandidates: 0,
		remoteCandidates: 0,
		handshakeState: 'Waiting',
		lastMethod: null,
		lastPath: null,
		lastStatus: null,
		lastError: null,
	};

	constructor(playgroundClient: RemoteAccessHostClient, relayUrl: string) {
		this.playgroundClient = playgroundClient;
		this.relayUrl = relayUrl;
	}

	async startSharing(): Promise<string> {
		if (this.isActive) {
			throw new Error('Already sharing');
		}

		this.setStatus('connecting');
		const response = await fetch(
			buildRemoteAccessRelayEndpointUrl(this.relayUrl, 'session'),
			{
				method: 'POST',
			}
		);
		if (!response.ok) {
			this.setStatus('error');
			throw new Error(
				`Failed to create session: ${await getResponseErrorMessage(response)}`
			);
		}

		const data: CreateSessionResponse = await response.json();
		this.sessionId = data.sessionId;
		this.shareUrl = data.shareUrl;
		this.accessCode = data.accessCode;
		this.isActive = true;

		this.updateMetrics({ handshakeState: 'Waiting for remote device' });
		this.startSignalPolling();
		this.startHeartbeat();
		return this.shareUrl;
	}

	async stopSharing(): Promise<void> {
		const sessionIdToClose = this.sessionId;
		this.isActive = false;
		this.stopHeartbeat();
		this.stopDataChannelOpenTimeout();
		this.dataChannel?.close();
		this.peerConnection?.close();
		this.dataChannel = null;
		this.peerConnection = null;
		this.requestQueue = [];
		this.isProcessingRequest = false;
		this.currentAttemptId = null;
		this.approvedAttemptId = null;
		this.pendingVerificationCode = null;
		this.pendingRemoteCandidates.clear();
		this.sessionId = null;
		this.shareUrl = null;
		this.accessCode = null;
		this.setStatus('disconnected');
		this.updateMetrics({
			pending: 0,
			processing: 0,
			handshakeState: 'Stopped',
		});

		if (sessionIdToClose) {
			try {
				await fetch(
					buildRemoteAccessRelayEndpointUrl(this.relayUrl, 'close', {
						sessionId: sessionIdToClose,
					}),
					{ method: 'POST', keepalive: true }
				);
			} catch (e) {
				logger.warn('[DirectTunnelHost] Close request failed:', e);
			}
		}
	}

	getSessionId(): string | null {
		return this.sessionId;
	}

	getAccessCode(): string | null {
		return this.accessCode;
	}

	getStatus(): TunnelHostStatus {
		return this.status;
	}

	getMetrics(): TunnelHostMetrics {
		return { ...this.metrics };
	}

	getPendingVerificationCode(): string | null {
		return this.pendingVerificationCode;
	}

	approveRemoteAccess(verificationCode: string): boolean {
		if (!this.isActive) {
			return false;
		}
		if (
			!this.currentAttemptId ||
			!this.pendingVerificationCode ||
			normalizeVerificationCode(verificationCode) !==
				this.pendingVerificationCode
		) {
			return false;
		}
		this.approvedAttemptId = this.currentAttemptId;
		this.pendingVerificationCode = null;
		this.sendDataChannelControlMessage({
			type: 'approved',
			attemptId: this.currentAttemptId,
		});
		this.updateMetrics({ handshakeState: 'Approved' });
		this.setStatus('connected');
		return true;
	}

	on<K extends keyof TunnelHostEvents>(
		event: K,
		listener: TunnelHostEvents[K]
	): () => void {
		let set = this.listeners[event] as Set<TunnelHostEvents[K]> | undefined;
		if (!set) {
			set = new Set<TunnelHostEvents[K]>();
			this.listeners[event] = set as (typeof this.listeners)[K];
		}
		set.add(listener);
		return () => {
			(
				this.listeners[event] as Set<TunnelHostEvents[K]> | undefined
			)?.delete(listener);
		};
	}

	private async createOffer(): Promise<void> {
		if (!this.sessionId) {
			throw new Error('Missing relay session');
		}
		if (this.isCreatingOffer) {
			return;
		}
		this.isCreatingOffer = true;
		const attemptId = crypto.randomUUID();
		this.currentAttemptId = attemptId;
		this.approvedAttemptId = null;
		this.pendingVerificationCode = null;
		this.pendingRemoteCandidates.clear();
		this.pendingChunkedRequests.clear();
		this.requestQueue = [];
		this.updateMetrics({
			handshakeAttempts: this.metrics.handshakeAttempts + 1,
			localCandidates: 0,
			remoteCandidates: 0,
			handshakeState: 'Creating offer',
		});
		this.dataChannel?.close();
		this.peerConnection?.close();
		const pc = createPeerConnection();
		this.peerConnection = pc;
		this.dataChannel = pc.createDataChannel('wordpress-http');
		this.configureDataChannel(this.dataChannel, attemptId);
		this.configurePeerConnection(pc, attemptId);

		try {
			const offer = await pc.createOffer();
			this.updateMetrics({ handshakeState: 'Setting local offer' });
			await pc.setLocalDescription(offer);
			await this.postSignal(
				'guest',
				'offer',
				createAttemptSignal(
					attemptId,
					serializeSessionDescription(pc.localDescription)
				)
			);
			this.updateMetrics({ handshakeState: 'Offer sent' });
			this.scheduleDataChannelOpenTimeout(attemptId);
		} finally {
			this.isCreatingOffer = false;
		}
	}

	private configurePeerConnection(
		pc: RTCPeerConnection,
		attemptId: string
	): void {
		pc.onicecandidate = (event) => {
			if (
				event.candidate &&
				isAttemptCurrent(this.currentAttemptId, attemptId)
			) {
				this.updateMetrics({
					localCandidates: this.metrics.localCandidates + 1,
					...(shouldShowIceCandidateState(this.metrics.handshakeState)
						? { handshakeState: 'Sending ICE candidate' }
						: {}),
				});
				this.postSignal(
					'guest',
					'candidate',
					createAttemptSignal(
						attemptId,
						serializeIceCandidate(event.candidate)
					)
				).catch((error) =>
					logger.warn('[DirectTunnelHost] ICE failed:', error)
				);
			}
		};
		pc.onconnectionstatechange = () => {
			if (!isAttemptCurrent(this.currentAttemptId, attemptId)) {
				return;
			}
			this.updateMetrics({
				handshakeState: `Peer ${pc.connectionState}`,
			});
			if (pc.connectionState === 'failed') {
				this.failCurrentAttempt(
					`Peer connection ${pc.connectionState}`
				);
			}
		};
	}

	private configureDataChannel(
		channel: RTCDataChannel,
		attemptId: string
	): void {
		channel.onopen = () => {
			if (!isAttemptCurrent(this.currentAttemptId, attemptId)) {
				channel.close();
				return;
			}
			this.stopDataChannelOpenTimeout();
			if (this.approvedAttemptId === attemptId) {
				this.sendDataChannelControlMessage({
					type: 'approved',
					attemptId,
				});
				this.updateMetrics({ handshakeState: 'Data channel open' });
				this.setStatus('connected');
				return;
			}
			this.sendDataChannelControlMessage({
				type: 'approval-required',
				attemptId,
			});
			this.updateMetrics({
				handshakeState: 'Waiting for host approval',
			});
			this.setStatus('pending-approval');
		};
		channel.onclose = () => {
			if (
				this.isActive &&
				isAttemptCurrent(this.currentAttemptId, attemptId)
			) {
				this.failCurrentAttempt('Data channel closed');
			}
		};
		channel.onmessage = (event) => {
			this.queueDataChannelMessage(event.data, attemptId);
		};
	}

	private scheduleDataChannelOpenTimeout(attemptId: string): void {
		this.stopDataChannelOpenTimeout();
		this.dataChannelOpenTimeout = setTimeout(() => {
			this.dataChannelOpenTimeout = null;
			if (
				!this.isActive ||
				!isAttemptCurrent(this.currentAttemptId, attemptId) ||
				this.dataChannel?.readyState === 'open'
			) {
				return;
			}
			this.updateMetrics({
				handshakeState: 'Data channel timed out',
			});
			this.failCurrentAttempt('Data channel timed out');
		}, DATA_CHANNEL_OPEN_TIMEOUT_MS);
	}

	private stopDataChannelOpenTimeout(): void {
		if (this.dataChannelOpenTimeout !== null) {
			clearTimeout(this.dataChannelOpenTimeout);
			this.dataChannelOpenTimeout = null;
		}
	}

	private failCurrentAttempt(message: string): void {
		this.stopDataChannelOpenTimeout();
		this.updateMetrics({
			handshakeState: message,
			lastError: message,
		});
		this.setStatus('error');
		this.emit('error', new Error(message));
	}

	private queueDataChannelMessage(data: unknown, attemptId: string): void {
		if (!this.dataChannel) {
			return;
		}
		const request = parseDataChannelMessage<DataChannelHostMessage>(
			data,
			'[DirectTunnelHost]'
		);
		if (!request) {
			this.updateMetrics({
				lastError: 'Invalid data channel message',
			});
			return;
		}
		if (isDataChannelControlMessage(request)) {
			this.handleDataChannelControlMessage(request, attemptId);
			return;
		}
		if (
			request.attemptId !== attemptId ||
			!isAttemptCurrent(this.currentAttemptId, attemptId)
		) {
			this.rejectStaleRequest(request);
			return;
		}
		if (request.type === 'backup-request') {
			this.handleBackupRequest(request);
			return;
		}
		if (isChunkedRequestMessage(request)) {
			this.handleChunkedRequestMessage(request);
			return;
		}
		if (request.type !== 'request') {
			return;
		}
		if (this.approvedAttemptId !== attemptId) {
			this.sendDataChannelResponse({
				type: 'response',
				requestId: request.requestId,
				status: 403,
				headers: { 'Content-Type': 'text/plain' },
				body: uint8ArrayToBase64(
					new TextEncoder().encode(
						'Waiting for approval on the host device.'
					)
				),
			});
			return;
		}

		this.requestQueue.push(request);
		this.updateMetrics({
			received: this.metrics.received + 1,
			pending: this.requestQueue.length,
			lastMethod: request.method,
			lastPath: request.path,
			lastError: null,
		});
		this.processQueue();
	}

	private handleChunkedRequestMessage(
		message:
			| DataChannelRequestStart
			| DataChannelRequestChunk
			| DataChannelRequestComplete
	): void {
		if (this.approvedAttemptId !== message.attemptId) {
			this.pendingChunkedRequests.delete(message.requestId);
			this.sendDataChannelResponse({
				type: 'response',
				requestId: message.requestId,
				status: 403,
				headers: { 'Content-Type': 'text/plain' },
				body: uint8ArrayToBase64(
					new TextEncoder().encode(
						'Waiting for approval on the host device.'
					)
				),
			});
			return;
		}

		if (message.type === 'request-start') {
			this.pendingChunkedRequests.set(message.requestId, {
				method: message.method,
				path: message.path,
				headers: message.headers,
				totalBytes: message.totalBytes,
				totalChunks: message.totalChunks,
				chunks: new Array(message.totalChunks),
			});
			return;
		}

		const pending = this.pendingChunkedRequests.get(message.requestId);
		if (!pending) {
			return;
		}

		if (message.type === 'request-chunk') {
			pending.chunks[message.index] = base64ToUint8Array(message.body);
			return;
		}

		this.pendingChunkedRequests.delete(message.requestId);
		const body = assembleDataChannelChunks(
			pending,
			'Incomplete remote access relay request'
		);
		if (body instanceof Error) {
			this.sendDataChannelResponse({
				type: 'response',
				requestId: message.requestId,
				status: 400,
				headers: { 'Content-Type': 'text/plain' },
				body: uint8ArrayToBase64(
					new TextEncoder().encode(body.message)
				),
			});
			return;
		}
		this.requestQueue.push({
			type: 'request',
			requestId: message.requestId,
			attemptId: message.attemptId,
			method: pending.method,
			path: pending.path,
			headers: pending.headers,
			body: uint8ArrayToBase64(body),
		});
		this.updateMetrics({
			received: this.metrics.received + 1,
			pending: this.requestQueue.length,
			lastMethod: pending.method,
			lastPath: pending.path,
			lastError: null,
		});
		this.processQueue();
	}

	private async handleBackupRequest(
		request: DataChannelBackupRequest
	): Promise<void> {
		if (this.approvedAttemptId !== request.attemptId) {
			this.sendDataChannelBackupError(
				request.requestId,
				'Waiting for approval on the host device.'
			);
			return;
		}
		try {
			const siteName =
				(await getWordPressSiteName(this.playgroundClient)) ||
				'playground';
			const bytes = await zipWpContent(this.playgroundClient, {
				selfContained: true,
			});
			const totalChunks = Math.ceil(
				bytes.length / DATA_CHANNEL_CHUNK_SIZE
			);
			this.sendDataChannelBackupMessage({
				type: 'backup-start',
				requestId: request.requestId,
				filename: formatBackupFilename(siteName),
				totalBytes: bytes.length,
				totalChunks,
			});
			for (let i = 0; i < totalChunks; i++) {
				this.sendDataChannelBackupMessage({
					type: 'backup-chunk',
					requestId: request.requestId,
					index: i,
					body: uint8ArrayToBase64(
						bytes.slice(
							i * DATA_CHANNEL_CHUNK_SIZE,
							(i + 1) * DATA_CHANNEL_CHUNK_SIZE
						)
					),
				});
				await this.waitForDataChannelDrain();
			}
			this.sendDataChannelBackupMessage({
				type: 'backup-complete',
				requestId: request.requestId,
			});
		} catch (error) {
			this.sendDataChannelBackupError(
				request.requestId,
				(error as Error).message
			);
		}
	}

	private handleDataChannelControlMessage(
		message: DataChannelControlMessage,
		attemptId: string
	): void {
		if (
			message.attemptId !== attemptId ||
			!isAttemptCurrent(this.currentAttemptId, attemptId)
		) {
			return;
		}
		if (
			message.type === 'verification-code' &&
			this.approvedAttemptId !== attemptId
		) {
			this.pendingVerificationCode = normalizeVerificationCode(
				message.code
			);
			this.updateMetrics({
				handshakeState: 'Remote verification received',
			});
			this.setStatus('pending-approval');
		}
	}

	private rejectStaleRequest(
		request:
			| DataChannelRequest
			| DataChannelRequestStart
			| DataChannelRequestChunk
			| DataChannelRequestComplete
			| DataChannelBackupRequest
	): void {
		if (request.type === 'backup-request') {
			this.sendDataChannelBackupError(
				request.requestId,
				'Remote access attempt expired.'
			);
			return;
		}
		if (isChunkedRequestMessage(request)) {
			this.pendingChunkedRequests.delete(request.requestId);
		}
		this.sendDataChannelResponse({
			type: 'response',
			requestId: request.requestId,
			status: 409,
			headers: { 'Content-Type': 'text/plain' },
			body: uint8ArrayToBase64(
				new TextEncoder().encode('Remote access attempt expired.')
			),
		}).catch((error) => {
			logger.warn('[DirectTunnelHost] Stale request failed:', error);
		});
	}

	private async processQueue(): Promise<void> {
		if (this.isProcessingRequest) {
			return;
		}
		this.isProcessingRequest = true;
		try {
			while (this.requestQueue.length > 0 && this.isActive) {
				const request = this.requestQueue.shift()!;
				this.updateMetrics({
					pending: this.requestQueue.length,
					processing: 1,
					lastMethod: request.method,
					lastPath: request.path,
				});
				try {
					await this.handleRequest(request);
				} catch (error) {
					logger.warn(
						'[DirectTunnelHost] Request handling failed:',
						error
					);
					this.updateMetrics({
						failed: this.metrics.failed + 1,
						lastStatus: 500,
						lastError: (error as Error).message,
					});
				}
				this.updateMetrics({
					processing: 0,
					pending: this.requestQueue.length,
				});
			}
		} finally {
			this.updateMetrics({
				processing: 0,
				pending: this.requestQueue.length,
			});
			this.isProcessingRequest = false;
		}
	}

	private async handleRequest(request: DataChannelRequest): Promise<void> {
		try {
			const phpResponse = await this.playgroundClient.request({
				method: request.method as HTTPMethod,
				url: request.path,
				headers: request.headers,
				body: request.body
					? base64ToUint8Array(request.body)
					: undefined,
			});
			const responseHeaders: Record<string, string> = {};
			for (const [key, values] of Object.entries(phpResponse.headers)) {
				if (key.toLowerCase() === 'set-cookie') {
					continue;
				}
				responseHeaders[key] = Array.isArray(values)
					? values.join(', ')
					: values;
			}
			const cookies = getHeaderValues(phpResponse.headers, 'set-cookie');
			await this.sendDataChannelResponse({
				type: 'response',
				requestId: request.requestId,
				status: phpResponse.httpStatusCode,
				headers: responseHeaders,
				cookies,
				body: '',
				bytes: phpResponse.bytes,
			});
			this.updateMetrics({
				completed: this.metrics.completed + 1,
				lastStatus: phpResponse.httpStatusCode,
			});
		} catch (error) {
			this.updateMetrics({
				failed: this.metrics.failed + 1,
				lastStatus: 500,
				lastError: (error as Error).message,
			});
			await this.sendDataChannelResponse({
				type: 'response',
				requestId: request.requestId,
				status: 500,
				headers: { 'Content-Type': 'text/plain' },
				body: uint8ArrayToBase64(
					new TextEncoder().encode((error as Error).message)
				),
			});
		}
	}

	private async sendDataChannelResponse(
		response: DataChannelResponse & { bytes?: Uint8Array }
	): Promise<void> {
		if (this.dataChannel?.readyState !== 'open') {
			throw new Error('Remote access data channel is not open');
		}
		const body = response.bytes ?? base64ToUint8Array(response.body);
		if (body.length <= DATA_CHANNEL_CHUNK_SIZE) {
			this.dataChannel.send(
				JSON.stringify({
					type: 'response',
					requestId: response.requestId,
					status: response.status,
					headers: response.headers,
					cookies: response.cookies,
					body:
						response.bytes === undefined
							? response.body
							: uint8ArrayToBase64(body),
				})
			);
			return;
		}
		const totalChunks = Math.ceil(body.length / DATA_CHANNEL_CHUNK_SIZE);
		this.sendDataChannelMessage({
			type: 'response-start',
			requestId: response.requestId,
			status: response.status,
			headers: response.headers,
			cookies: response.cookies,
			totalBytes: body.length,
			totalChunks,
		});
		for (let i = 0; i < totalChunks; i++) {
			this.sendDataChannelMessage({
				type: 'response-chunk',
				requestId: response.requestId,
				index: i,
				body: uint8ArrayToBase64(
					body.slice(
						i * DATA_CHANNEL_CHUNK_SIZE,
						(i + 1) * DATA_CHANNEL_CHUNK_SIZE
					)
				),
			});
			await this.waitForDataChannelDrain();
		}
		this.sendDataChannelMessage({
			type: 'response-complete',
			requestId: response.requestId,
		});
	}

	private sendDataChannelBackupMessage(
		message:
			| DataChannelBackupStart
			| DataChannelBackupChunk
			| DataChannelBackupComplete
			| DataChannelBackupError
	): void {
		this.sendDataChannelMessage(message);
	}

	private sendDataChannelMessage(message: DataChannelGuestMessage): void {
		if (this.dataChannel?.readyState !== 'open') {
			throw new Error('Remote access data channel is not open');
		}
		this.dataChannel.send(JSON.stringify(message));
	}

	private sendDataChannelBackupError(requestId: string, error: string): void {
		this.sendDataChannelBackupMessage({
			type: 'backup-error',
			requestId,
			error,
		});
	}

	private async waitForDataChannelDrain(): Promise<void> {
		const channel = this.dataChannel;
		if (!channel || channel.readyState !== 'open') {
			throw new Error('Remote access data channel is not open');
		}
		if (channel.bufferedAmount < 1024 * 1024) {
			return;
		}
		channel.bufferedAmountLowThreshold = 512 * 1024;
		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => {
				cleanup();
				reject(new Error('Remote access data channel did not drain'));
			}, 30000);
			const cleanup = () => {
				clearTimeout(timeout);
				channel.removeEventListener(
					'bufferedamountlow',
					handleBufferedAmountLow
				);
			};
			const handleBufferedAmountLow = () => {
				cleanup();
				resolve();
			};
			channel.addEventListener(
				'bufferedamountlow',
				handleBufferedAmountLow
			);
		});
	}

	private sendDataChannelControlMessage(
		message: DataChannelControlMessage
	): void {
		if (this.dataChannel?.readyState !== 'open') {
			return;
		}
		this.dataChannel.send(JSON.stringify(message));
	}

	private async startSignalPolling(): Promise<void> {
		while (this.isActive && this.sessionId) {
			try {
				const response = await fetch(
					buildRemoteAccessRelayEndpointUrl(this.relayUrl, 'signal', {
						sessionId: this.sessionId,
						to: 'host',
						since: this.signalCursor,
					})
				);
				if (!response.ok) {
					throw new Error(
						`Signal poll failed: ${response.statusText}`
					);
				}
				const data: SignalPollResponse = await response.json();
				this.signalCursor = data.cursor;
				await this.handleSignals(data.messages);
			} catch (error) {
				if (this.isActive) {
					logger.warn(
						'[DirectTunnelHost] Signal poll failed:',
						error
					);
					await new Promise((resolve) => setTimeout(resolve, 1000));
				}
			}
		}
	}

	private async handleSignals(messages: SignalMessage[]): Promise<void> {
		for (const message of messages) {
			if (message.type === 'retry-request') {
				this.updateMetrics({ handshakeState: 'Retry requested' });
				this.setStatus('connecting');
				await this.createOffer();
				continue;
			}
			if (!this.peerConnection) {
				continue;
			}
			if (message.type === 'answer') {
				const signal = readAttemptSignal(message.data);
				if (
					!signal ||
					!isAttemptCurrent(this.currentAttemptId, signal.attemptId)
				) {
					continue;
				}
				this.updateMetrics({ handshakeState: 'Answer received' });
				await this.peerConnection.setRemoteDescription(
					isSessionDescription(signal.payload)
				);
				this.updateMetrics({ handshakeState: 'Remote answer set' });
				await this.flushRemoteCandidates(signal.attemptId);
			} else if (message.type === 'candidate') {
				const signal = readAttemptSignal(message.data);
				if (
					!signal ||
					!isAttemptCurrent(this.currentAttemptId, signal.attemptId)
				) {
					continue;
				}
				this.updateMetrics({
					remoteCandidates: this.metrics.remoteCandidates + 1,
					...(shouldShowIceCandidateState(this.metrics.handshakeState)
						? {
								handshakeState: 'Remote ICE candidate received',
							}
						: {}),
				});
				await this.addOrBufferRemoteCandidate(
					signal.attemptId,
					isIceCandidate(signal.payload)
				);
			}
		}
	}

	private async addOrBufferRemoteCandidate(
		attemptId: string,
		candidate: RTCIceCandidateInit
	): Promise<void> {
		if (
			!this.peerConnection ||
			!isAttemptCurrent(this.currentAttemptId, attemptId)
		) {
			return;
		}
		if (!this.peerConnection.remoteDescription) {
			bufferRemoteCandidate(
				this.pendingRemoteCandidates,
				attemptId,
				candidate
			);
			return;
		}
		await addIceCandidateIfCurrent(
			this.peerConnection,
			candidate,
			'[DirectTunnelHost]'
		);
	}

	private async flushRemoteCandidates(attemptId: string): Promise<void> {
		if (
			!this.peerConnection ||
			!isAttemptCurrent(this.currentAttemptId, attemptId)
		) {
			return;
		}
		await flushRemoteCandidates(
			this.pendingRemoteCandidates,
			attemptId,
			this.peerConnection,
			'[DirectTunnelHost]'
		);
	}

	private startHeartbeat(): void {
		this.stopHeartbeat();
		this.heartbeatInterval = setInterval(() => {
			this.postSignal('guest', 'heartbeat', null).catch(() => {});
		}, 3000);
		this.postSignal('guest', 'heartbeat', null).catch(() => {});
	}

	private stopHeartbeat(): void {
		if (this.heartbeatInterval !== null) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
		}
	}

	private async postSignal(
		to: PeerRole,
		type: SignalType,
		data: unknown
	): Promise<void> {
		if (!this.sessionId) {
			return;
		}
		await fetch(
			buildRemoteAccessRelayEndpointUrl(this.relayUrl, 'signal', {
				sessionId: this.sessionId,
			}),
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					from: 'host',
					to,
					type,
					data,
				}),
			}
		);
	}

	private emit<K extends keyof TunnelHostEvents>(
		event: K,
		...args: Parameters<TunnelHostEvents[K]>
	): void {
		const set = this.listeners[event] as
			| Set<TunnelHostEvents[K]>
			| undefined;
		set?.forEach((listener) => {
			(listener as (...a: Parameters<TunnelHostEvents[K]>) => void)(
				...args
			);
		});
	}

	private setStatus(status: TunnelHostStatus): void {
		if (this.status !== status) {
			this.status = status;
			this.emit('statusChange', status);
		}
	}

	private updateMetrics(metrics: Partial<TunnelHostMetrics>): void {
		this.metrics = {
			...this.metrics,
			...metrics,
		};
		this.emit('metricsChange', this.getMetrics());
	}
}

async function getResponseErrorMessage(response: Response): Promise<string> {
	const fallback = `${response.status} ${response.statusText}`.trim();
	try {
		const contentType = response.headers.get('content-type') || '';
		if (contentType.includes('application/json')) {
			const data = await response.json();
			if (typeof data?.error === 'string') {
				return `${fallback}: ${data.error}`;
			}
		} else {
			const text = (await response.text()).trim();
			if (text) {
				return `${fallback}: ${text.slice(0, 240)}`;
			}
		}
	} catch {
		// Fall back to the HTTP status below.
	}
	return fallback;
}

export class DirectTunnelGuest {
	private readonly sessionId: string;
	private readonly relayUrl: string;
	private readonly guestId: string;
	private readonly verificationCode: string;
	private peerConnection: RTCPeerConnection | null = null;
	private dataChannel: RTCDataChannel | null = null;
	private localCandidates = 0;
	private remoteCandidates = 0;
	private signalCursor = 0;
	private currentAttemptId: string | null = null;
	private approvedAttemptId: string | null = null;
	private pendingRemoteCandidates = new Map<string, RTCIceCandidateInit[]>();
	private pendingRequests = new Map<
		string,
		{
			resolve: (response: TunnelResponse) => void;
			reject: (error: Error) => void;
			timeout: ReturnType<typeof setTimeout>;
			status?: number;
			headers?: Record<string, string>;
			cookies?: string[];
			totalBytes?: number;
			totalChunks?: number;
			chunks?: Uint8Array[];
		}
	>();
	private pendingBackups = new Map<
		string,
		{
			resolve: (backup: { filename: string; bytes: Uint8Array }) => void;
			reject: (error: Error) => void;
			timeout: ReturnType<typeof setTimeout>;
			filename: string | null;
			totalBytes: number;
			totalChunks: number;
			chunks: Uint8Array[];
		}
	>();
	private isActive = false;
	private onStatusChange: (
		status: 'connecting' | 'connected' | 'error',
		detail: string
	) => void;

	constructor(options: {
		sessionId: string;
		relayUrl: string;
		guestId: string;
		verificationCode: string;
		onStatusChange: (
			status: 'connecting' | 'connected' | 'error',
			detail: string
		) => void;
	}) {
		this.sessionId = options.sessionId;
		this.relayUrl = options.relayUrl;
		this.guestId = options.guestId;
		this.verificationCode = normalizeVerificationCode(
			options.verificationCode
		);
		this.onStatusChange = options.onStatusChange;
	}

	start(): void {
		this.isActive = true;
		this.reportStatus('connecting');
		this.startSignalPolling();
		this.requestFreshOffer().catch((error) => {
			logger.warn('[DirectTunnelGuest] Retry request failed:', error);
			this.reportStatus(
				'error',
				`retry request failed: ${(error as Error).message}`
			);
		});
	}

	stop(): void {
		this.isActive = false;
		this.dataChannel?.close();
		this.peerConnection?.close();
		this.currentAttemptId = null;
		this.approvedAttemptId = null;
		this.pendingRemoteCandidates.clear();
		this.rejectPendingMessages(new Error('Remote access disconnected'));
	}

	private rejectPendingMessages(error: Error): void {
		for (const pending of this.pendingRequests.values()) {
			clearTimeout(pending.timeout);
			pending.reject(error);
		}
		this.pendingRequests.clear();
		for (const pending of this.pendingBackups.values()) {
			clearTimeout(pending.timeout);
			pending.reject(error);
		}
		this.pendingBackups.clear();
	}

	async request(request: TunnelRequest): Promise<TunnelResponse> {
		if (this.dataChannel?.readyState !== 'open') {
			throw new Error('Host data channel is not connected');
		}
		const attemptId = this.getApprovedAttemptId();
		const message: Omit<DataChannelRequest, 'body'> = {
			requestId: request.requestId,
			method: request.method,
			path: request.path,
			headers: request.headers,
			type: 'request',
			attemptId,
		};
		const response = new Promise<TunnelResponse>((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pendingRequests.delete(request.requestId);
				reject(new Error('Host request timed out'));
			}, 30000);
			this.pendingRequests.set(request.requestId, {
				resolve,
				reject,
				timeout,
			});
		});
		try {
			await this.sendDataChannelRequest(message, request.body);
		} catch (error) {
			const pending = this.pendingRequests.get(request.requestId);
			if (pending) {
				clearTimeout(pending.timeout);
				this.pendingRequests.delete(request.requestId);
			}
			throw error;
		}
		return response;
	}

	private async sendDataChannelRequest(
		message: Omit<DataChannelRequest, 'body'>,
		body: Uint8Array | undefined
	): Promise<void> {
		if (!body || body.length <= DATA_CHANNEL_CHUNK_SIZE) {
			this.sendDataChannelHostMessage({
				...message,
				body: body ? uint8ArrayToBase64(body) : undefined,
			});
			return;
		}

		const totalChunks = Math.ceil(body.length / DATA_CHANNEL_CHUNK_SIZE);
		this.sendDataChannelHostMessage({
			type: 'request-start',
			requestId: message.requestId,
			attemptId: message.attemptId,
			method: message.method,
			path: message.path,
			headers: message.headers,
			totalBytes: body.length,
			totalChunks,
		});
		for (let i = 0; i < totalChunks; i++) {
			this.sendDataChannelHostMessage({
				type: 'request-chunk',
				requestId: message.requestId,
				attemptId: message.attemptId,
				index: i,
				body: uint8ArrayToBase64(
					body.slice(
						i * DATA_CHANNEL_CHUNK_SIZE,
						(i + 1) * DATA_CHANNEL_CHUNK_SIZE
					)
				),
			});
			await this.waitForDataChannelDrain();
		}
		this.sendDataChannelHostMessage({
			type: 'request-complete',
			requestId: message.requestId,
			attemptId: message.attemptId,
		});
	}

	private sendDataChannelHostMessage(message: DataChannelHostMessage): void {
		if (this.dataChannel?.readyState !== 'open') {
			throw new Error('Host data channel is not connected');
		}
		this.dataChannel.send(JSON.stringify(message));
	}

	private async waitForDataChannelDrain(): Promise<void> {
		const channel = this.dataChannel;
		if (!channel || channel.readyState !== 'open') {
			throw new Error('Host data channel is not connected');
		}
		if (channel.bufferedAmount < 1024 * 1024) {
			return;
		}
		channel.bufferedAmountLowThreshold = 512 * 1024;
		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => {
				cleanup();
				reject(new Error('Host data channel did not drain'));
			}, 30000);
			const cleanup = () => {
				clearTimeout(timeout);
				channel.removeEventListener(
					'bufferedamountlow',
					handleBufferedAmountLow
				);
			};
			const handleBufferedAmountLow = () => {
				cleanup();
				resolve();
			};
			channel.addEventListener(
				'bufferedamountlow',
				handleBufferedAmountLow
			);
		});
	}

	async downloadBackup(): Promise<{ filename: string; bytes: Uint8Array }> {
		if (this.dataChannel?.readyState !== 'open') {
			throw new Error('Host data channel is not connected');
		}
		const attemptId = this.getApprovedAttemptId();
		const requestId = crypto.randomUUID();
		const message: DataChannelBackupRequest = {
			type: 'backup-request',
			requestId,
			attemptId,
		};
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pendingBackups.delete(requestId);
				reject(new Error('Backup download timed out'));
			}, 120000);
			this.pendingBackups.set(requestId, {
				resolve,
				reject,
				timeout,
				filename: null,
				totalBytes: 0,
				totalChunks: 0,
				chunks: [],
			});
			this.dataChannel?.send(JSON.stringify(message));
		});
	}

	private async startSignalPolling(): Promise<void> {
		while (this.isActive) {
			try {
				const response = await fetch(
					buildRemoteAccessRelayEndpointUrl(this.relayUrl, 'signal', {
						sessionId: this.sessionId,
						to: 'guest',
						since: this.signalCursor,
						gid: this.guestId,
					})
				);
				if (!response.ok) {
					throw new Error(
						`Signal poll failed: ${response.statusText}`
					);
				}
				const data: SignalPollResponse = await response.json();
				this.signalCursor = data.cursor;
				await this.handleSignals(data.messages);
			} catch (error) {
				if (this.isActive) {
					logger.warn(
						'[DirectTunnelGuest] Signal poll failed:',
						error
					);
					this.reportStatus(
						'error',
						`signal poll failed: ${(error as Error).message}`
					);
					await new Promise((resolve) => setTimeout(resolve, 1000));
				}
			}
		}
	}

	private async handleSignals(messages: SignalMessage[]): Promise<void> {
		let latestOffer: SignalMessage | null = null;
		for (const message of messages) {
			if (message.type === 'offer') {
				latestOffer = message;
			}
		}
		if (latestOffer) {
			const signal = readAttemptSignal(latestOffer.data);
			if (signal) {
				await this.acceptOffer(
					signal.attemptId,
					isSessionDescription(signal.payload)
				);
			}
		}

		for (const message of messages) {
			if (message.type === 'offer') {
				continue;
			}
			if (message.type === 'candidate') {
				const signal = readAttemptSignal(message.data);
				if (!signal) {
					continue;
				}
				if (isAttemptCurrent(this.currentAttemptId, signal.attemptId)) {
					this.remoteCandidates++;
				}
				await this.addOrBufferRemoteCandidate(
					signal.attemptId,
					isIceCandidate(signal.payload)
				);
			}
		}
	}

	private async acceptOffer(
		attemptId: string,
		offer: RTCSessionDescriptionInit
	): Promise<void> {
		this.peerConnection?.close();
		this.dataChannel?.close();
		this.currentAttemptId = attemptId;
		this.approvedAttemptId = null;
		for (const key of this.pendingRemoteCandidates.keys()) {
			if (key !== attemptId) {
				this.pendingRemoteCandidates.delete(key);
			}
		}
		this.localCandidates = 0;
		this.remoteCandidates = 0;
		this.rejectPendingMessages(
			new Error('Remote access attempt restarted')
		);
		const pc = createPeerConnection();
		this.peerConnection = pc;
		pc.onicecandidate = (event) => {
			if (
				event.candidate &&
				isAttemptCurrent(this.currentAttemptId, attemptId)
			) {
				this.localCandidates++;
				this.reportStatus('connecting');
				this.postSignal(
					'host',
					'candidate',
					createAttemptSignal(
						attemptId,
						serializeIceCandidate(event.candidate)
					)
				).catch((error) =>
					logger.warn('[DirectTunnelGuest] ICE failed:', error)
				);
			}
		};
		pc.ondatachannel = (event) => {
			if (!isAttemptCurrent(this.currentAttemptId, attemptId)) {
				event.channel.close();
				return;
			}
			this.dataChannel = event.channel;
			this.configureDataChannel(event.channel, attemptId);
		};
		pc.onconnectionstatechange = () => {
			if (!isAttemptCurrent(this.currentAttemptId, attemptId)) {
				return;
			}
			if (pc.connectionState === 'failed') {
				this.reportStatus('error');
			}
		};
		pc.oniceconnectionstatechange = () => {
			if (!isAttemptCurrent(this.currentAttemptId, attemptId)) {
				return;
			}
			this.reportStatus(
				this.dataChannel?.readyState === 'open' &&
					this.isCurrentAttemptApproved()
					? 'connected'
					: 'connecting'
			);
		};
		await pc.setRemoteDescription(offer);
		await this.flushRemoteCandidates(attemptId);
		const answer = await pc.createAnswer();
		await pc.setLocalDescription(answer);
		await this.postSignal(
			'host',
			'answer',
			createAttemptSignal(
				attemptId,
				serializeSessionDescription(pc.localDescription)
			)
		);
	}

	private async addOrBufferRemoteCandidate(
		attemptId: string,
		candidate: RTCIceCandidateInit
	): Promise<void> {
		if (!isAttemptCurrent(this.currentAttemptId, attemptId)) {
			bufferRemoteCandidate(
				this.pendingRemoteCandidates,
				attemptId,
				candidate
			);
			return;
		}
		if (!this.peerConnection?.remoteDescription) {
			bufferRemoteCandidate(
				this.pendingRemoteCandidates,
				attemptId,
				candidate
			);
			return;
		}
		await addIceCandidateIfCurrent(
			this.peerConnection,
			candidate,
			'[DirectTunnelGuest]'
		);
	}

	private async flushRemoteCandidates(attemptId: string): Promise<void> {
		if (
			!this.peerConnection ||
			!isAttemptCurrent(this.currentAttemptId, attemptId)
		) {
			return;
		}
		await flushRemoteCandidates(
			this.pendingRemoteCandidates,
			attemptId,
			this.peerConnection,
			'[DirectTunnelGuest]'
		);
	}

	private isCurrentAttemptApproved(): boolean {
		return (
			!!this.currentAttemptId &&
			this.approvedAttemptId === this.currentAttemptId
		);
	}

	private getApprovedAttemptId(): string {
		if (!this.isCurrentAttemptApproved()) {
			throw new Error('Waiting for approval on the host device');
		}
		return this.currentAttemptId!;
	}

	private configureDataChannel(
		channel: RTCDataChannel,
		attemptId: string
	): void {
		channel.onopen = () => {
			if (!isAttemptCurrent(this.currentAttemptId, attemptId)) {
				channel.close();
				return;
			}
			this.sendDataChannelControlMessage({
				type: 'verification-code',
				code: this.verificationCode,
				attemptId,
			});
			this.reportStatus('connecting', 'waiting for host approval');
		};
		channel.onclose = () => {
			if (
				this.isActive &&
				isAttemptCurrent(this.currentAttemptId, attemptId)
			) {
				this.approvedAttemptId = null;
				this.reportStatus('connecting');
			}
		};
		channel.onmessage = (event) => {
			const response = parseDataChannelMessage<DataChannelGuestMessage>(
				event.data,
				'[DirectTunnelGuest]'
			);
			if (!response) {
				this.reportStatus('connecting', 'invalid data channel message');
				return;
			}
			if (
				isDataChannelControlMessage(response) &&
				response.attemptId !== attemptId
			) {
				return;
			}
			if (response.type === 'approval-required') {
				this.approvedAttemptId = null;
				this.reportStatus('connecting', 'waiting for host approval');
				return;
			}
			if (response.type === 'approved') {
				this.approvedAttemptId = attemptId;
				this.reportStatus('connected');
				return;
			}
			if (this.handleResponseMessage(response)) {
				return;
			}
			if (this.handleBackupMessage(response)) {
				return;
			}
		};
	}

	private handleResponseMessage(message: DataChannelGuestMessage): boolean {
		if (
			message.type !== 'response' &&
			message.type !== 'response-start' &&
			message.type !== 'response-chunk' &&
			message.type !== 'response-complete'
		) {
			return false;
		}
		const pending = this.pendingRequests.get(message.requestId);
		if (!pending) {
			return true;
		}
		if (message.type === 'response') {
			clearTimeout(pending.timeout);
			this.pendingRequests.delete(message.requestId);
			pending.resolve({
				requestId: message.requestId,
				status: message.status,
				headers: message.headers,
				cookies: message.cookies,
				body: base64ToUint8Array(message.body),
			});
			return true;
		}
		if (message.type === 'response-start') {
			pending.status = message.status;
			pending.headers = message.headers;
			pending.cookies = message.cookies;
			pending.totalBytes = message.totalBytes;
			pending.totalChunks = message.totalChunks;
			pending.chunks = new Array(message.totalChunks);
			return true;
		}
		if (message.type === 'response-chunk') {
			pending.chunks ??= [];
			pending.chunks[message.index] = base64ToUint8Array(message.body);
			return true;
		}
		clearTimeout(pending.timeout);
		this.pendingRequests.delete(message.requestId);
		const response = assembleChunkedDataChannelResponse(
			pending,
			'Incomplete remote access relay response'
		);
		if (response instanceof Error) {
			pending.reject(response);
			return true;
		}
		pending.resolve({ ...response, requestId: message.requestId });
		return true;
	}

	private handleBackupMessage(message: DataChannelGuestMessage): boolean {
		if (
			message.type !== 'backup-start' &&
			message.type !== 'backup-chunk' &&
			message.type !== 'backup-complete' &&
			message.type !== 'backup-error'
		) {
			return false;
		}
		const pending = this.pendingBackups.get(message.requestId);
		if (!pending) {
			return true;
		}
		if (message.type === 'backup-error') {
			clearTimeout(pending.timeout);
			this.pendingBackups.delete(message.requestId);
			pending.reject(new Error(message.error));
			return true;
		}
		if (message.type === 'backup-start') {
			pending.filename = message.filename;
			pending.totalBytes = message.totalBytes;
			pending.totalChunks = message.totalChunks;
			pending.chunks = new Array(message.totalChunks);
			return true;
		}
		if (message.type === 'backup-chunk') {
			pending.chunks[message.index] = base64ToUint8Array(message.body);
			return true;
		}
		clearTimeout(pending.timeout);
		this.pendingBackups.delete(message.requestId);
		if (
			!pending.filename ||
			pending.chunks.length !== pending.totalChunks
		) {
			pending.reject(new Error('Incomplete backup response'));
			return true;
		}
		const bytes = new Uint8Array(pending.totalBytes);
		let offset = 0;
		for (const chunk of pending.chunks) {
			if (!chunk) {
				pending.reject(new Error('Incomplete backup response'));
				return true;
			}
			bytes.set(chunk, offset);
			offset += chunk.length;
		}
		pending.resolve({
			filename: pending.filename,
			bytes,
		});
		return true;
	}

	private sendDataChannelControlMessage(
		message: DataChannelControlMessage
	): void {
		if (this.dataChannel?.readyState !== 'open') {
			return;
		}
		this.dataChannel.send(JSON.stringify(message));
	}

	private reportStatus(
		status: 'connecting' | 'connected' | 'error',
		detail = this.connectionDetail()
	): void {
		this.onStatusChange(status, detail);
	}

	private connectionDetail(): string {
		const pc = this.peerConnection;
		const dc = this.dataChannel;
		return [
			`pc:${pc?.connectionState ?? '-'}`,
			`ice:${pc?.iceConnectionState ?? '-'}`,
			`signal:${pc?.signalingState ?? '-'}`,
			`dc:${dc?.readyState ?? '-'}`,
			`localIce:${this.localCandidates}`,
			`remoteIce:${this.remoteCandidates}`,
		].join(' ');
	}

	private async requestFreshOffer(): Promise<void> {
		await this.postSignal('host', 'retry-request', {
			guestId: this.guestId,
		});
	}

	private async postSignal(
		to: PeerRole,
		type: SignalType,
		data: unknown
	): Promise<void> {
		await fetch(
			buildRemoteAccessRelayEndpointUrl(this.relayUrl, 'signal', {
				sessionId: this.sessionId,
			}),
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					from: 'guest',
					to,
					type,
					data,
				}),
			}
		);
	}
}
