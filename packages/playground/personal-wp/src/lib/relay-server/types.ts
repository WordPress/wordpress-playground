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

export interface GuestInfo {
	id: string;
	label: string;
	lastSeenMs: number;
}

export interface SessionStatusResponse {
	sessionId: string;
	hostConnected: boolean;
	/**
	 * True when the host is connected AND has polled recently enough that
	 * we still consider the session live. The guest uses this to decide
	 * whether to render a "host disconnected" overlay.
	 */
	hostAlive: boolean;
	lastPollAgoMs: number;
	/**
	 * Currently-connected guests. The list is computed on every /status
	 * call by pruning entries that haven't heartbeated within the guest
	 * timeout window (~10s).
	 */
	guests: GuestInfo[];
}

export interface CreateSessionResponse {
	sessionId: string;
	shareUrl: string;
	accessCode: string;
}

export interface PollResponse {
	timeout?: boolean;
	request?: TunnelRequest;
	requests?: TunnelRequest[];
}
