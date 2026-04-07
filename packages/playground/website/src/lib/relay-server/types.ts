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
	/**
	 * Last time the host successfully hit the long-poll endpoint. Used to
	 * detect a host that stopped polling (e.g. closed the tab) without
	 * waiting for the full session timeout.
	 */
	lastPollAt: number;
	hostConnected: boolean;
	pendingRequests: Map<string, QueuedRequest>;
	pollResolvers: Array<(request: TunnelRequest | null) => void>;
	/**
	 * Anonymous collaborator tracking. Each guest browser tab generates a
	 * stable UUID, sends it on every status heartbeat, and gets pruned
	 * once it stops checking in. The ordinal stays stable for the lifetime
	 * of the session so labels like "Guest 1" don't shuffle around.
	 */
	guests: Map<string, GuestRecord>;
	nextGuestOrdinal: number;
}

export interface GuestRecord {
	id: string;
	ordinal: number;
	label: string;
	firstSeenAt: number;
	lastSeenAt: number;
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
}

export interface PollResponse {
	timeout?: boolean;
	request?: TunnelRequest;
}
