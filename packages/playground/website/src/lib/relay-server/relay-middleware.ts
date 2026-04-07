/**
 * Relay middleware for tunneling HTTP requests between host and guest browsers.
 *
 * This enables peer-to-peer sharing of Playground instances by acting as a
 * relay between a host (who has a running Playground) and guests (who want
 * to view/interact with it).
 *
 * Endpoints:
 * - POST /relay/session - Create a new tunnel session
 * - GET /relay/:sessionId/poll - Host long-polls for guest requests
 * - POST /relay/:sessionId/response/:requestId - Host sends response
 * - ALL /relay/:sessionId/request/* - Guest requests (proxied to host)
 */

import type { Connect } from 'vite';
import type {
	TunnelSession,
	TunnelRequest,
	TunnelResponse,
	QueuedRequest,
	CreateSessionResponse,
	PollResponse,
	SessionStatusResponse,
	GuestInfo,
	GuestRecord,
} from './types';

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const POLL_TIMEOUT = 25 * 1000; // 25 seconds
const REQUEST_TIMEOUT = 30 * 1000; // 30 seconds
/**
 * How long without a host poll before we consider the host "dead". A
 * healthy host re-polls immediately after each timeout (25s), so ~40s
 * gives one poll's worth of slack for network hiccups before we flip
 * hostConnected to false and fail pending guest requests fast.
 */
const HOST_DEAD_AFTER_MS = 40 * 1000;
/**
 * How long without a guest heartbeat before we drop them from the
 * collaborator list. Guests heartbeat every ~3s via the /status
 * endpoint, so 10s gives roughly three missed beats before we forget
 * them — fast enough to feel "live", lax enough to ride out a hiccup.
 */
const GUEST_DEAD_AFTER_MS = 10 * 1000;

const sessions = new Map<string, TunnelSession>();

function generateSessionId(): string {
	return crypto.randomUUID();
}

function generateRequestId(): string {
	return crypto.randomUUID();
}

/**
 * Mark a session's host as disconnected and fail anything that was
 * waiting on it. Safe to call multiple times.
 */
function markHostDisconnected(session: TunnelSession, reason: string): void {
	if (session.hostConnected) {
		console.log(
			`[Relay] Marking host disconnected for session ${session.sessionId}: ${reason}`
		);
	}
	session.hostConnected = false;
	for (const queued of session.pendingRequests.values()) {
		clearTimeout(queued.timeoutId);
		queued.reject(new Error('Host disconnected'));
	}
	session.pendingRequests.clear();
}

/**
 * Drop any guests that have stopped heartbeating. Returns the surviving
 * guests as a serializable list, sorted by ordinal so the order is
 * stable across calls.
 */
function pruneGuests(session: TunnelSession, now: number): GuestInfo[] {
	for (const [gid, guest] of session.guests) {
		if (now - guest.lastSeenAt > GUEST_DEAD_AFTER_MS) {
			session.guests.delete(gid);
		}
	}
	return Array.from(session.guests.values())
		.sort((a, b) => a.ordinal - b.ordinal)
		.map((g) => ({
			id: g.id,
			label: g.label,
			lastSeenMs: now - g.lastSeenAt,
		}));
}

/**
 * Register a heartbeat for a guest, creating its record on first sight.
 * The ordinal — and therefore the "Guest N" label — sticks for the
 * lifetime of the session even if the guest reconnects.
 */
function recordGuestHeartbeat(
	session: TunnelSession,
	guestId: string,
	now: number
): GuestRecord {
	let guest = session.guests.get(guestId);
	if (!guest) {
		const ordinal = session.nextGuestOrdinal++;
		guest = {
			id: guestId,
			ordinal,
			label: `Guest ${ordinal}`,
			firstSeenAt: now,
			lastSeenAt: now,
		};
		session.guests.set(guestId, guest);
	} else {
		guest.lastSeenAt = now;
	}
	return guest;
}

function cleanupExpiredSessions(): void {
	const now = Date.now();
	for (const [sessionId, session] of sessions) {
		// Detect hosts that stopped polling. We do this before the full
		// session timeout so guests see a "host disconnected" state
		// within seconds instead of half a minute.
		if (
			session.hostConnected &&
			session.lastPollAt > 0 &&
			now - session.lastPollAt > HOST_DEAD_AFTER_MS
		) {
			markHostDisconnected(session, 'no poll received');
		}

		// Age out silent guests so the host's collaborator list shrinks
		// even if no /status request comes in to do it for us.
		pruneGuests(session, now);

		if (now - session.lastActivity > SESSION_TIMEOUT) {
			// Reject any pending requests
			for (const queued of session.pendingRequests.values()) {
				clearTimeout(queued.timeoutId);
				queued.reject(new Error('Session expired'));
			}
			// Resolve any waiting poll requests
			for (const resolve of session.pollResolvers) {
				resolve(null);
			}
			sessions.delete(sessionId);
		}
	}
}

// Run cleanup every 5 seconds so the host-dead detection reacts quickly.
setInterval(cleanupExpiredSessions, 5 * 1000);

function getSession(sessionId: string): TunnelSession | undefined {
	const session = sessions.get(sessionId);
	if (session) {
		session.lastActivity = Date.now();
	}
	return session;
}

function parseBody(req: Connect.IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		let body = '';
		req.on('data', (chunk: Buffer) => {
			body += chunk.toString();
		});
		req.on('end', () => resolve(body));
		req.on('error', reject);
	});
}

type HttpServerResponse = import('http').ServerResponse;

function sendJson(res: unknown, status: number, data: unknown): void {
	const jsonRes = res as HttpServerResponse;
	jsonRes.statusCode = status;
	jsonRes.setHeader('Content-Type', 'application/json');
	jsonRes.setHeader('Access-Control-Allow-Origin', '*');
	jsonRes.setHeader(
		'Access-Control-Allow-Methods',
		'GET, POST, PUT, DELETE, OPTIONS'
	);
	jsonRes.setHeader(
		'Access-Control-Allow-Headers',
		'Content-Type, X-Request-Id'
	);
	jsonRes.end(JSON.stringify(data));
}

function sendError(res: unknown, status: number, message: string): void {
	sendJson(res, status, { error: message });
}

export interface RelayMiddlewareOptions {
	/** Base path for the website (e.g., '/website-server/' in dev mode) */
	basePath?: string;
}

/**
 * Create a Vite/Connect middleware for the relay server.
 */
export function createRelayMiddleware(
	options: RelayMiddlewareOptions = {}
): Connect.NextHandleFunction {
	const basePath = options.basePath || '/';

	return async (req, res, next) => {
		const url = req.url || '';

		// Handle CORS preflight
		if (req.method === 'OPTIONS' && url.startsWith('/relay/')) {
			const httpRes = res as unknown as import('http').ServerResponse;
			httpRes.statusCode = 204;
			httpRes.setHeader('Access-Control-Allow-Origin', '*');
			httpRes.setHeader(
				'Access-Control-Allow-Methods',
				'GET, POST, PUT, DELETE, OPTIONS'
			);
			httpRes.setHeader(
				'Access-Control-Allow-Headers',
				'Content-Type, X-Request-Id'
			);
			httpRes.setHeader('Access-Control-Max-Age', '86400');
			httpRes.end();
			return;
		}

		// POST /relay/session - Create new session
		if (req.method === 'POST' && url === '/relay/session') {
			const sessionId = generateSessionId();
			const session: TunnelSession = {
				sessionId,
				createdAt: Date.now(),
				lastActivity: Date.now(),
				lastPollAt: 0,
				hostConnected: false,
				pendingRequests: new Map(),
				pollResolvers: [],
				guests: new Map(),
				nextGuestOrdinal: 1,
			};
			sessions.set(sessionId, session);

			const protocol = req.headers['x-forwarded-proto'] || 'http';
			const host = req.headers.host || 'localhost';
			const shareUrl = `${protocol}://${host}${basePath}?share=${sessionId}`;

			const response: CreateSessionResponse = { sessionId, shareUrl };
			sendJson(res, 200, response);
			return;
		}

		// GET /relay/:sessionId/poll - Host polls for requests
		const pollMatch = url.match(/^\/relay\/([^/]+)\/poll$/);
		if (req.method === 'GET' && pollMatch) {
			const sessionId = pollMatch[1];
			const session = getSession(sessionId);

			if (!session) {
				console.log(`[Relay] Poll: session ${sessionId} not found`);
				sendError(
					res,
					404,
					'Session not found'
				);
				return;
			}

			session.hostConnected = true;
			session.lastPollAt = Date.now();
			console.log(`[Relay] Poll: session ${sessionId}, pending requests: ${session.pendingRequests.size}`);

			// Check if there are pending requests that haven't been dispatched yet
			const pendingRequest = Array.from(
				session.pendingRequests.values()
			).find((req) => !req.dispatched);
			if (pendingRequest) {
				// Mark as dispatched so we don't return it again
				pendingRequest.dispatched = true;
				const response: PollResponse = {
					request: pendingRequest.request,
				};
				sendJson(res, 200, response);
				return;
			}

			// Long-poll: wait for a request or timeout
			const timeoutPromise = new Promise<TunnelRequest | null>(
				(resolve) => {
					setTimeout(() => resolve(null), POLL_TIMEOUT);
				}
			);

			let resolverFn: ((req: TunnelRequest | null) => void) | null =
				null;
			const requestPromise = new Promise<TunnelRequest | null>(
				(resolve) => {
					resolverFn = resolve;
					session.pollResolvers.push(resolve);
				}
			);

			const result = await Promise.race([timeoutPromise, requestPromise]);

			// Remove this resolver from the list. Must look up by the
			// resolver function itself; the previous code searched for the
			// Promise, which never matched and left stale resolvers behind
			// that would silently consume later guest requests.
			if (resolverFn) {
				const index = session.pollResolvers.indexOf(resolverFn);
				if (index > -1) {
					session.pollResolvers.splice(index, 1);
				}
			}

			if (result === null) {
				const response: PollResponse = { timeout: true };
				sendJson(res, 200, response);
			} else {
				const response: PollResponse = { request: result };
				sendJson(res, 200, response);
			}
			return;
		}

		// POST /relay/:sessionId/response/:requestId - Host sends response
		const responseMatch = url.match(
			/^\/relay\/([^/]+)\/response\/([^/]+)$/
		);
		if (req.method === 'POST' && responseMatch) {
			const sessionId = responseMatch[1];
			const requestId = responseMatch[2];
			const session = getSession(sessionId);

			if (!session) {
				sendError(
					res,
					404,
					'Session not found'
				);
				return;
			}

			const queued = session.pendingRequests.get(requestId);
			if (!queued) {
				sendError(
					res,
					404,
					'Request not found'
				);
				return;
			}

			const body = await parseBody(req);
			const tunnelResponse: TunnelResponse = JSON.parse(body);

			clearTimeout(queued.timeoutId);
			session.pendingRequests.delete(requestId);
			queued.resolve(tunnelResponse);

			sendJson(res, 200, { ok: true });
			return;
		}

		// GET /relay/:sessionId/status - Guest polls session health.
		// Lets the guest UI flip to a "host disconnected" state without
		// waiting for a tunneled request to time out. Doubles as the
		// guest heartbeat: if the request includes a `?gid=<uuid>` query
		// param we record/refresh that guest in the session's collaborator
		// map. The host periodically polls the same endpoint without a
		// gid to see who is currently connected.
		const statusMatch = url.match(/^\/relay\/([^/?]+)\/status(?:\?(.*))?$/);
		if (req.method === 'GET' && statusMatch) {
			const sessionId = statusMatch[1];
			const queryString = statusMatch[2] || '';
			const session = sessions.get(sessionId);
			if (!session) {
				sendError(res, 404, 'Session not found');
				return;
			}
			const now = Date.now();
			// Proactively age-out a silent host so the very first status
			// request after a host disappears already reports disconnected.
			if (
				session.hostConnected &&
				session.lastPollAt > 0 &&
				now - session.lastPollAt > HOST_DEAD_AFTER_MS
			) {
				markHostDisconnected(session, 'status check: no poll');
			}

			// Heartbeat handling: a guest tab tags itself by passing
			// `?gid=<uuid>` so we can build a stable collaborator list
			// without inventing identity per-request.
			const params = new URLSearchParams(queryString);
			const guestId = params.get('gid');
			if (guestId) {
				recordGuestHeartbeat(session, guestId, now);
			}

			const guests = pruneGuests(session, now);
			const lastPollAgoMs =
				session.lastPollAt > 0 ? now - session.lastPollAt : -1;
			const response: SessionStatusResponse = {
				sessionId,
				hostConnected: session.hostConnected,
				hostAlive:
					session.hostConnected &&
					session.lastPollAt > 0 &&
					lastPollAgoMs < HOST_DEAD_AFTER_MS,
				lastPollAgoMs,
				guests,
			};
			sendJson(res, 200, response);
			return;
		}

		// POST /relay/:sessionId/close - Host explicitly closes the session.
		// Sent via navigator.sendBeacon on pagehide so guests see the
		// disconnect immediately instead of after the dead-host timer.
		const closeMatch = url.match(/^\/relay\/([^/]+)\/close$/);
		if (req.method === 'POST' && closeMatch) {
			const sessionId = closeMatch[1];
			const session = sessions.get(sessionId);
			if (session) {
				markHostDisconnected(session, 'host requested close');
				// Wake any pending polls so long-running host fetches
				// don't hold the connection open after close.
				while (session.pollResolvers.length > 0) {
					const resolver = session.pollResolvers.shift();
					resolver?.(null);
				}
			}
			sendJson(res, 200, { ok: true });
			return;
		}

		// ALL /relay/:sessionId/request/* - Guest requests
		const requestMatch = url.match(/^\/relay\/([^/]+)\/request(\/.*)?$/);
		if (requestMatch) {
			const sessionId = requestMatch[1];
			const path = requestMatch[2] || '/';
			const session = getSession(sessionId);

			console.log(`[Relay] Guest request: ${path} for session ${sessionId}`);

			if (!session) {
				console.log(`[Relay] Guest request: session not found`);
				sendError(
					res,
					404,
					'Session not found'
				);
				return;
			}

			if (!session.hostConnected) {
				console.log(`[Relay] Guest request: host not connected`);
				sendError(
					res,
					503,
					'Host not connected'
				);
				return;
			}

			const requestId = generateRequestId();
			const body = await parseBody(req);

			const headers: Record<string, string> = {};
			for (const [key, value] of Object.entries(req.headers)) {
				if (typeof value === 'string') {
					headers[key] = value;
				} else if (Array.isArray(value)) {
					headers[key] = value[0];
				}
			}

			const tunnelRequest: TunnelRequest = {
				requestId,
				method: req.method || 'GET',
				path,
				headers,
				body: body || undefined,
			};

			// Create a promise that will be resolved when the host responds
			const responsePromise = new Promise<TunnelResponse>(
				(resolve, reject) => {
					const timeoutId = setTimeout(() => {
						console.log(`[Relay] Request ${requestId} timed out after ${REQUEST_TIMEOUT}ms`);
						session.pendingRequests.delete(requestId);
						reject(new Error('Request timeout'));
					}, REQUEST_TIMEOUT);

					const queued: QueuedRequest = {
						request: tunnelRequest,
						resolve,
						reject,
						timeoutId,
						dispatched: false,
					};

					session.pendingRequests.set(requestId, queued);

					// Notify any waiting poll resolvers and mark as dispatched
					const pollResolver = session.pollResolvers.shift();
					if (pollResolver) {
						queued.dispatched = true;
						pollResolver(tunnelRequest);
					}
				}
			);

			try {
				const tunnelResponse = await responsePromise;
				console.log(`[Relay] Got response for ${requestId}: status ${tunnelResponse.status}`);
				const httpRes = res as import('http').ServerResponse;

				httpRes.statusCode = tunnelResponse.status;
				for (const [key, value] of Object.entries(
					tunnelResponse.headers
				)) {
					// Skip certain headers that shouldn't be forwarded
					if (
						![
							'transfer-encoding',
							'connection',
							'keep-alive',
						].includes(key.toLowerCase())
					) {
						httpRes.setHeader(key, value);
					}
				}
				httpRes.setHeader('Access-Control-Allow-Origin', '*');

				// Decode base64 body if it was encoded
				if (tunnelResponse.body) {
					const bodyBuffer = Buffer.from(
						tunnelResponse.body,
						'base64'
					);
					httpRes.end(bodyBuffer);
				} else {
					httpRes.end();
				}
			} catch (error) {
				sendError(
					res,
					504,
					'Gateway timeout'
				);
			}
			return;
		}

		// Not a relay request, pass to next middleware
		next();
	};
}

/**
 * Get the number of active sessions (for debugging/monitoring).
 */
export function getActiveSessions(): number {
	return sessions.size;
}

/**
 * Clear all sessions (for testing).
 */
export function clearAllSessions(): void {
	for (const session of sessions.values()) {
		for (const queued of session.pendingRequests.values()) {
			clearTimeout(queued.timeoutId);
			queued.reject(new Error('Sessions cleared'));
		}
		for (const resolve of session.pollResolvers) {
			resolve(null);
		}
	}
	sessions.clear();
}
