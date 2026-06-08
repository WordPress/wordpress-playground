import { logger } from '@php-wasm/logger';
import type { PlaygroundClient } from '@wp-playground/remote';

export type TunnelHostStatus =
	| 'disconnected'
	| 'connecting'
	| 'connected'
	| 'error';

export interface TunnelHostMetrics {
	received: number;
	pending: number;
	processing: number;
	completed: number;
	failed: number;
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
	body?: string;
}

interface TunnelResponse {
	requestId: string;
	status: number;
	headers: Record<string, string>;
	body: string;
}

type PeerRole = 'host' | 'guest';

type SignalType = 'offer' | 'answer' | 'candidate' | 'heartbeat';

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

interface DataChannelRequest extends TunnelRequest {
	type: 'request';
	body?: string;
}

interface DataChannelResponse extends TunnelResponse {
	type: 'response';
}

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

function createPeerConnection(): RTCPeerConnection {
	return new RTCPeerConnection({
		iceServers: [],
	});
}

function isSessionDescription(value: unknown): RTCSessionDescriptionInit {
	if (!value || typeof value !== 'object') {
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

/**
 * Phone-side direct tunnel. The relay is only used to exchange WebRTC
 * signaling messages; WordPress HTTP requests are handled over the data channel.
 */
export class DirectTunnelHost {
	private readonly playgroundClient: PlaygroundClient;
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
	private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
	private isCreatingOffer = false;
	private requestQueue: DataChannelRequest[] = [];
	private isProcessingRequest = false;
	private metrics: TunnelHostMetrics = {
		received: 0,
		pending: 0,
		processing: 0,
		completed: 0,
		failed: 0,
		lastMethod: null,
		lastPath: null,
		lastStatus: null,
		lastError: null,
	};

	constructor(playgroundClient: PlaygroundClient, relayUrl: string) {
		this.playgroundClient = playgroundClient;
		this.relayUrl = relayUrl;
	}

	async startSharing(): Promise<string> {
		if (this.isActive) {
			throw new Error('Already sharing');
		}

		this.setStatus('connecting');
		const response = await fetch(`${this.relayUrl}/relay/session`, {
			method: 'POST',
		});
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

		await this.createOffer();
		this.startSignalPolling();
		this.startHeartbeat();
		return this.shareUrl;
	}

	async stopSharing(): Promise<void> {
		const sessionIdToClose = this.sessionId;
		this.isActive = false;
		this.stopHeartbeat();
		this.stopReconnect();
		this.dataChannel?.close();
		this.peerConnection?.close();
		this.dataChannel = null;
		this.peerConnection = null;
		this.requestQueue = [];
		this.isProcessingRequest = false;
		this.sessionId = null;
		this.shareUrl = null;
		this.accessCode = null;
		this.setStatus('disconnected');
		this.updateMetrics({ pending: 0, processing: 0 });

		if (sessionIdToClose) {
			try {
				await fetch(
					`${this.relayUrl}/relay/${sessionIdToClose}/close`,
					{ method: 'POST', keepalive: true }
				);
			} catch (e) {
				logger.warn('[DirectTunnelHost] Close request failed:', e);
			}
		}
	}

	getShareUrl(): string | null {
		return this.shareUrl;
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
		this.dataChannel?.close();
		this.peerConnection?.close();
		const pc = createPeerConnection();
		this.peerConnection = pc;
		this.dataChannel = pc.createDataChannel('wordpress-http');
		this.configureDataChannel(this.dataChannel);
		this.configurePeerConnection(pc);

		try {
			const offer = await pc.createOffer();
			await pc.setLocalDescription(offer);
			await this.postSignal('guest', 'offer', pc.localDescription);
		} finally {
			this.isCreatingOffer = false;
		}
	}

	private configurePeerConnection(pc: RTCPeerConnection): void {
		pc.onicecandidate = (event) => {
			if (event.candidate) {
				this.postSignal('guest', 'candidate', event.candidate).catch(
					(error) =>
						logger.warn('[DirectTunnelHost] ICE failed:', error)
				);
			}
		};
		pc.onconnectionstatechange = () => {
			if (
				pc.connectionState === 'failed' ||
				pc.connectionState === 'disconnected'
			) {
				this.setStatus('connecting');
				this.scheduleReconnect();
			}
		};
	}

	private configureDataChannel(channel: RTCDataChannel): void {
		channel.onopen = () => {
			this.stopReconnect();
			this.setStatus('connected');
		};
		channel.onclose = () => {
			if (this.isActive) {
				this.setStatus('connecting');
				this.scheduleReconnect();
			}
		};
		channel.onmessage = (event) => {
			this.queueDataChannelMessage(event.data);
		};
	}

	private scheduleReconnect(): void {
		if (!this.isActive || this.reconnectTimeout !== null) {
			return;
		}
		this.reconnectTimeout = setTimeout(() => {
			this.reconnectTimeout = null;
			if (!this.isActive) {
				return;
			}
			this.createOffer().catch((error) => {
				logger.warn('[DirectTunnelHost] Reconnect failed:', error);
				this.scheduleReconnect();
			});
		}, 1000);
	}

	private stopReconnect(): void {
		if (this.reconnectTimeout !== null) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}
	}

	private queueDataChannelMessage(data: unknown): void {
		if (typeof data !== 'string' || !this.dataChannel) {
			return;
		}
		const request = JSON.parse(data) as DataChannelRequest;
		if (request.type !== 'request') {
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

	private async processQueue(): Promise<void> {
		if (this.isProcessingRequest) {
			return;
		}
		this.isProcessingRequest = true;
		while (this.requestQueue.length > 0 && this.isActive) {
			const request = this.requestQueue.shift()!;
			this.updateMetrics({
				pending: this.requestQueue.length,
				processing: 1,
				lastMethod: request.method,
				lastPath: request.path,
			});
			await this.handleRequest(request);
			this.updateMetrics({
				processing: 0,
				pending: this.requestQueue.length,
			});
		}
		this.isProcessingRequest = false;
	}

	private async handleRequest(request: DataChannelRequest): Promise<void> {
		try {
			const phpResponse = await this.playgroundClient.request({
				method: request.method as any,
				url: request.path,
				headers: request.headers,
				body: request.body
					? base64ToUint8Array(request.body)
					: undefined,
			});
			const responseHeaders: Record<string, string> = {};
			for (const [key, values] of Object.entries(phpResponse.headers)) {
				responseHeaders[key] = Array.isArray(values)
					? values.join(', ')
					: values;
			}
			this.sendDataChannelResponse({
				type: 'response',
				requestId: request.requestId,
				status: phpResponse.httpStatusCode,
				headers: responseHeaders,
				body: uint8ArrayToBase64(phpResponse.bytes),
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
			this.sendDataChannelResponse({
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

	private sendDataChannelResponse(response: DataChannelResponse): void {
		if (this.dataChannel?.readyState !== 'open') {
			throw new Error('Desktop data channel is not open');
		}
		this.dataChannel.send(JSON.stringify(response));
	}

	private async startSignalPolling(): Promise<void> {
		while (this.isActive && this.sessionId) {
			try {
				const response = await fetch(
					`${this.relayUrl}/relay/${this.sessionId}/signal?to=host&since=${this.signalCursor}`
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
			if (!this.peerConnection) {
				continue;
			}
			if (message.type === 'answer') {
				await this.peerConnection.setRemoteDescription(
					isSessionDescription(message.data)
				);
			} else if (message.type === 'candidate') {
				await this.peerConnection.addIceCandidate(
					isIceCandidate(message.data)
				);
			}
		}
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
		await fetch(`${this.relayUrl}/relay/${this.sessionId}/signal`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				from: 'host',
				to,
				type,
				data,
			}),
		});
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
	private peerConnection: RTCPeerConnection | null = null;
	private dataChannel: RTCDataChannel | null = null;
	private signalCursor = 0;
	private pendingRequests = new Map<
		string,
		{
			resolve: (response: DataChannelResponse) => void;
			reject: (error: Error) => void;
			timeout: ReturnType<typeof setTimeout>;
		}
	>();
	private isActive = false;
	private onStatusChange: (
		status: 'connecting' | 'connected' | 'error'
	) => void;

	constructor(options: {
		sessionId: string;
		relayUrl: string;
		guestId: string;
		onStatusChange: (status: 'connecting' | 'connected' | 'error') => void;
	}) {
		this.sessionId = options.sessionId;
		this.relayUrl = options.relayUrl;
		this.guestId = options.guestId;
		this.onStatusChange = options.onStatusChange;
	}

	start(): void {
		this.isActive = true;
		this.onStatusChange('connecting');
		this.startSignalPolling();
	}

	stop(): void {
		this.isActive = false;
		this.dataChannel?.close();
		this.peerConnection?.close();
		for (const pending of this.pendingRequests.values()) {
			clearTimeout(pending.timeout);
			pending.reject(new Error('Desktop access disconnected'));
		}
		this.pendingRequests.clear();
	}

	async request(
		request: Omit<DataChannelRequest, 'type'>
	): Promise<DataChannelResponse> {
		if (this.dataChannel?.readyState !== 'open') {
			throw new Error('Phone data channel is not connected');
		}
		const message: DataChannelRequest = {
			...request,
			type: 'request',
		};
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pendingRequests.delete(request.requestId);
				reject(new Error('Phone request timed out'));
			}, 30000);
			this.pendingRequests.set(request.requestId, {
				resolve,
				reject,
				timeout,
			});
			this.dataChannel?.send(JSON.stringify(message));
		});
	}

	private async startSignalPolling(): Promise<void> {
		while (this.isActive) {
			try {
				const response = await fetch(
					`${this.relayUrl}/relay/${this.sessionId}/signal?to=guest&since=${this.signalCursor}&gid=${encodeURIComponent(
						this.guestId
					)}`
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
					this.onStatusChange('error');
					await new Promise((resolve) => setTimeout(resolve, 1000));
				}
			}
		}
	}

	private async handleSignals(messages: SignalMessage[]): Promise<void> {
		for (const message of messages) {
			if (message.type === 'offer') {
				await this.acceptOffer(isSessionDescription(message.data));
			} else if (message.type === 'candidate' && this.peerConnection) {
				await this.peerConnection.addIceCandidate(
					isIceCandidate(message.data)
				);
			}
		}
	}

	private async acceptOffer(offer: RTCSessionDescriptionInit): Promise<void> {
		this.peerConnection?.close();
		const pc = createPeerConnection();
		this.peerConnection = pc;
		pc.onicecandidate = (event) => {
			if (event.candidate) {
				this.postSignal('host', 'candidate', event.candidate).catch(
					(error) =>
						logger.warn('[DirectTunnelGuest] ICE failed:', error)
				);
			}
		};
		pc.ondatachannel = (event) => {
			this.dataChannel = event.channel;
			this.configureDataChannel(event.channel);
		};
		pc.onconnectionstatechange = () => {
			if (
				pc.connectionState === 'failed' ||
				pc.connectionState === 'disconnected'
			) {
				this.onStatusChange('error');
			}
		};
		await pc.setRemoteDescription(offer);
		const answer = await pc.createAnswer();
		await pc.setLocalDescription(answer);
		await this.postSignal('host', 'answer', pc.localDescription);
	}

	private configureDataChannel(channel: RTCDataChannel): void {
		channel.onopen = () => this.onStatusChange('connected');
		channel.onclose = () => {
			if (this.isActive) {
				this.onStatusChange('connecting');
			}
		};
		channel.onmessage = (event) => {
			if (typeof event.data !== 'string') {
				return;
			}
			const response = JSON.parse(event.data) as DataChannelResponse;
			if (response.type !== 'response') {
				return;
			}
			const pending = this.pendingRequests.get(response.requestId);
			if (!pending) {
				return;
			}
			clearTimeout(pending.timeout);
			this.pendingRequests.delete(response.requestId);
			pending.resolve(response);
		};
	}

	private async postSignal(
		to: PeerRole,
		type: SignalType,
		data: unknown
	): Promise<void> {
		await fetch(`${this.relayUrl}/relay/${this.sessionId}/signal`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				from: 'guest',
				to,
				type,
				data,
			}),
		});
	}
}
