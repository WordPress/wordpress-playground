/**
 * Types for the relay server tunneling system.
 *
 * The relay server enables peer-to-peer sharing of Playground instances
 * by tunneling HTTP requests through long-polling connections.
 */

export interface TunnelRequest {
	requestId: string;
	method: string;
	path: string;
	headers: Record<string, string>;
	body?: string;
}

export interface TunnelResponse {
	requestId: string;
	status: number;
	headers: Record<string, string>;
	body: string;
}

export interface QueuedRequest {
	request: TunnelRequest;
	resolve: (response: TunnelResponse) => void;
	reject: (error: Error) => void;
	timeoutId: ReturnType<typeof setTimeout>;
	/** Whether this request has been dispatched to the host for processing */
	dispatched: boolean;
}

export interface TunnelSession {
	sessionId: string;
	createdAt: number;
	lastActivity: number;
	hostConnected: boolean;
	pendingRequests: Map<string, QueuedRequest>;
	pollResolvers: Array<(request: TunnelRequest | null) => void>;
}

export interface CreateSessionResponse {
	sessionId: string;
	shareUrl: string;
}

export interface PollResponse {
	timeout?: boolean;
	request?: TunnelRequest;
}
