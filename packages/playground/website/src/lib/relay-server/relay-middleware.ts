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
} from './types';

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const POLL_TIMEOUT = 25 * 1000; // 25 seconds
const REQUEST_TIMEOUT = 30 * 1000; // 30 seconds

const sessions = new Map<string, TunnelSession>();

function generateSessionId(): string {
	return crypto.randomUUID();
}

function generateRequestId(): string {
	return crypto.randomUUID();
}

function cleanupExpiredSessions(): void {
	const now = Date.now();
	for (const [sessionId, session] of sessions) {
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

// Run cleanup every minute
setInterval(cleanupExpiredSessions, 60 * 1000);

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
				hostConnected: false,
				pendingRequests: new Map(),
				pollResolvers: [],
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

			const requestPromise = new Promise<TunnelRequest | null>(
				(resolve) => {
					session.pollResolvers.push(resolve);
				}
			);

			const result = await Promise.race([timeoutPromise, requestPromise]);

			// Remove this resolver from the list
			const index = session.pollResolvers.indexOf(
				requestPromise as unknown as (
					request: TunnelRequest | null
				) => void
			);
			if (index > -1) {
				session.pollResolvers.splice(index, 1);
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
