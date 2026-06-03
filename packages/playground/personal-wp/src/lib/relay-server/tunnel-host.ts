/**
 * TunnelHost manages a sharing session where this browser acts as the host.
 *
 * The host polls the relay server for incoming guest requests, processes them
 * through the local Playground instance, and sends responses back.
 */

import { logger } from '@php-wasm/logger';
import { joinPaths, normalizePath } from '@php-wasm/util';
import type { PlaygroundClient } from '@wp-playground/remote';
import { createRelayUrlRewriter } from './url-rewriter';
import type {
	TunnelRequest,
	TunnelResponse,
	CreateSessionResponse,
	PollResponse,
} from './types';

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

function rewriteLocationHeader(
	value: string,
	relayPrefix: string,
	originalHost: string
): string {
	if (value.startsWith('/relay/')) {
		return value;
	}
	if (value.startsWith('/')) {
		return `${relayPrefix}${removeScopePrefix(value)}`;
	}
	try {
		const url = new URL(value);
		if (
			(url.protocol === 'http:' || url.protocol === 'https:') &&
			url.host === originalHost
		) {
			return `${relayPrefix}${removeScopePrefix(url.pathname)}${url.search}${url.hash}`;
		}
	} catch {
		return value;
	}
	return value;
}

function removeScopePrefix(path: string): string {
	const match = path.match(/^\/scope:[^/]+(\/.*)?$/);
	return match ? match[1] || '/' : path;
}

const STATIC_ASSET_MIME_TYPES: Record<string, string> = {
	css: 'text/css',
	js: 'application/javascript',
	mjs: 'application/javascript',
	json: 'application/json',
	map: 'application/json',
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	svg: 'image/svg+xml',
	webp: 'image/webp',
	ico: 'image/x-icon',
	woff: 'font/woff',
	woff2: 'font/woff2',
	ttf: 'font/ttf',
	eot: 'application/vnd.ms-fontobject',
};

export type TunnelHostStatus =
	| 'disconnected'
	| 'connecting'
	| 'connected'
	| 'error';

export interface TunnelHostEvents {
	statusChange: (status: TunnelHostStatus) => void;
	requestProcessed: (request: TunnelRequest) => void;
	error: (error: Error) => void;
}

/**
 * Internal listener storage. We keep one Set per event name and type
 * each Set with the actual listener signature for that event so the
 * `on()`/`emit()` plumbing stays type-safe end-to-end.
 */
type ListenerMap = {
	[K in keyof TunnelHostEvents]: Set<TunnelHostEvents[K]>;
};

export class TunnelHost {
	private readonly playgroundClient: PlaygroundClient;
	private readonly relayUrl: string;
	private sessionId: string | null = null;
	private shareUrl: string | null = null;
	private accessCode: string | null = null;
	private pollAbortController: AbortController | null = null;
	private isActive = false;
	private status: TunnelHostStatus = 'disconnected';
	private listeners: Partial<ListenerMap> = {};

	/**
	 * Queue of pending requests to process sequentially.
	 * PlaygroundClient can only handle one request at a time (single-threaded PHP),
	 * so we need to queue requests to avoid overwhelming it.
	 */
	private requestQueue: TunnelRequest[] = [];
	private isProcessingRequest = false;

	/**
	 * Hard cap on how many guest requests we'll buffer in host RAM at
	 * once. The polling loop pauses while the queue is at capacity so
	 * the relay's long-poll keeps holding the next request instead of
	 * handing it to us early. Without this, a misbehaving guest (or
	 * just a slow PHP run) lets the queue grow without bound.
	 *
	 * 32 is comfortably above what one normal WordPress page load
	 * fans out (~15-25 sub-resources) but small enough that even if
	 * the host is wedged for a few seconds, we don't accumulate
	 * megabytes of pending request bodies in memory.
	 */
	private static readonly MAX_QUEUE_SIZE = 32;

	/**
	 * Tripped by stopSharing() so the in-flight handleRequest can
	 * notice and refuse to forward its response. We can't actually
	 * cancel the PHP run inside the worker — playgroundClient.request()
	 * has no AbortSignal — but stopping the *response* still matters:
	 * it's what makes "Stop Sharing" mean stop from the guest's
	 * perspective and keeps us from POSTing into a torn-down (or worse,
	 * recycled) session id.
	 */
	private currentRequestController: AbortController | null = null;

	/**
	 * Reference we keep so we can remove the pagehide listener on stop.
	 * Fires a sendBeacon POST to /relay/:id/close so guests see the
	 * disconnect immediately instead of waiting for the dead-host timer.
	 */
	private pagehideHandler: (() => void) | null = null;

	constructor(playgroundClient: PlaygroundClient, relayUrl: string) {
		this.playgroundClient = playgroundClient;
		this.relayUrl = relayUrl;
	}

	/**
	 * Start a sharing session and return the share URL.
	 */
	async startSharing(): Promise<string> {
		if (this.isActive) {
			throw new Error('Already sharing');
		}

		this.setStatus('connecting');

		try {
			const response = await fetch(`${this.relayUrl}/relay/session`, {
				method: 'POST',
			});

			if (!response.ok) {
				throw new Error(
					`Failed to create session: ${response.statusText}`
				);
			}

			const data: CreateSessionResponse = await response.json();
			this.sessionId = data.sessionId;
			this.shareUrl = data.shareUrl;
			this.accessCode = data.accessCode;
			this.isActive = true;

			this.setStatus('connected');
			this.startPolling();
			this.installPagehideBeacon();

			return this.shareUrl;
		} catch (error) {
			this.setStatus('error');
			throw error;
		}
	}

	/**
	 * Stop the sharing session.
	 */
	async stopSharing(): Promise<void> {
		const sessionIdToClose = this.sessionId;
		// Order matters here. We flip isActive false BEFORE clearing
		// any references so that anything still mid-await in
		// processQueue / handleRequest / sendResponse sees the new
		// state on its next checkpoint and bails out cleanly instead
		// of trying to use a torn-down session.
		this.isActive = false;
		this.pollAbortController?.abort();
		this.pollAbortController = null;
		this.currentRequestController?.abort();
		this.currentRequestController = null;
		this.sessionId = null;
		this.shareUrl = null;
		this.accessCode = null;
		this.requestQueue = [];
		this.isProcessingRequest = false;
		this.removePagehideBeacon();
		this.setStatus('disconnected');

		// Best-effort close on the relay so guests disconnect immediately.
		if (sessionIdToClose) {
			try {
				await fetch(
					`${this.relayUrl}/relay/${sessionIdToClose}/close`,
					{ method: 'POST', keepalive: true }
				);
			} catch (e) {
				// Non-fatal — relay will fall back to the dead-host timer.
				logger.warn('[TunnelHost] Close request failed:', e);
			}
		}
	}

	/**
	 * Wire a pagehide listener that fires a close beacon to the relay.
	 * sendBeacon is the only reliable way to ship a request during
	 * unload, so even a hard tab close notifies the relay right away.
	 */
	private installPagehideBeacon(): void {
		if (typeof window === 'undefined' || this.pagehideHandler) {
			return;
		}
		const relayUrl = this.relayUrl;
		const sessionIdRef = () => this.sessionId;
		this.pagehideHandler = () => {
			const sid = sessionIdRef();
			if (!sid) return;
			const url = `${relayUrl}/relay/${sid}/close`;
			try {
				if (navigator.sendBeacon) {
					navigator.sendBeacon(
						url,
						new Blob([], { type: 'text/plain' })
					);
				} else {
					fetch(url, { method: 'POST', keepalive: true }).catch(
						() => {}
					);
				}
			} catch {
				// swallow — best-effort
			}
		};
		window.addEventListener('pagehide', this.pagehideHandler);
	}

	private removePagehideBeacon(): void {
		if (typeof window === 'undefined' || !this.pagehideHandler) {
			return;
		}
		window.removeEventListener('pagehide', this.pagehideHandler);
		this.pagehideHandler = null;
	}

	/**
	 * Add a request to the processing queue.
	 * Requests are processed sequentially since PlaygroundClient is single-threaded.
	 */
	private queueRequest(request: TunnelRequest): void {
		if (this.canHandleAsStaticAsset(request)) {
			void this.handleStaticAssetRequest(request);
			return;
		}
		this.requestQueue.push(request);
		this.processQueue();
	}

	/**
	 * Process queued requests one at a time.
	 */
	private async processQueue(): Promise<void> {
		if (this.isProcessingRequest) {
			return;
		}
		if (this.requestQueue.length === 0) {
			return;
		}

		this.isProcessingRequest = true;

		while (this.requestQueue.length > 0 && this.isActive) {
			const request = this.requestQueue.shift()!;
			// One AbortController per request so stopSharing() can
			// signal "drop whatever you're holding" without affecting
			// any future request that might land in the same loop.
			this.currentRequestController = new AbortController();
			const signal = this.currentRequestController.signal;
			try {
				await this.handleRequest(request, signal);
			} catch (error) {
				if ((error as Error)?.name !== 'AbortError') {
					logger.error(
						`[TunnelHost] Error handling request ${request.requestId}:`,
						error
					);
					this.emit('error', error as Error);
				}
			} finally {
				this.currentRequestController = null;
			}
		}

		this.isProcessingRequest = false;
	}

	/**
	 * Get the current share URL.
	 */
	getShareUrl(): string | null {
		return this.shareUrl;
	}

	/**
	 * Get the current session ID.
	 */
	getSessionId(): string | null {
		return this.sessionId;
	}

	getAccessCode(): string | null {
		return this.accessCode;
	}

	/**
	 * Get the current connection status.
	 */
	getStatus(): TunnelHostStatus {
		return this.status;
	}

	/**
	 * Subscribe to events.
	 */
	on<K extends keyof TunnelHostEvents>(
		event: K,
		listener: TunnelHostEvents[K]
	): () => void {
		let set = this.listeners[event] as Set<TunnelHostEvents[K]> | undefined;
		if (!set) {
			set = new Set<TunnelHostEvents[K]>();
			this.listeners[event] = set as ListenerMap[K];
		}
		set.add(listener);
		return () => {
			(
				this.listeners[event] as Set<TunnelHostEvents[K]> | undefined
			)?.delete(listener);
		};
	}

	private emit<K extends keyof TunnelHostEvents>(
		event: K,
		...args: Parameters<TunnelHostEvents[K]>
	): void {
		const set = this.listeners[event] as
			| Set<TunnelHostEvents[K]>
			| undefined;
		set?.forEach((listener) => {
			try {
				(listener as (...a: Parameters<TunnelHostEvents[K]>) => void)(
					...args
				);
			} catch {
				// Listener errors are intentionally swallowed so one bad
				// subscriber can't take down the rest of the chain.
			}
		});
	}

	private setStatus(status: TunnelHostStatus): void {
		if (this.status !== status) {
			this.status = status;
			this.emit('statusChange', status);
		}
	}

	/**
	 * Main polling loop - continuously polls for guest requests.
	 */
	private async startPolling(): Promise<void> {
		while (this.isActive && this.sessionId) {
			// Backpressure: while the queue is at capacity, don't claim
			// any more requests from the relay. The relay's long-poll
			// keeps the next request waiting on its side until we're
			// ready, which is exactly the throttling we want — bytes
			// stay on the relay's disk instead of in our RAM.
			if (this.requestQueue.length >= TunnelHost.MAX_QUEUE_SIZE) {
				await new Promise((resolve) => setTimeout(resolve, 100));
				continue;
			}
			try {
				this.pollAbortController = new AbortController();

				const response = await fetch(
					`${this.relayUrl}/relay/${this.sessionId}/poll`,
					{
						signal: this.pollAbortController.signal,
					}
				);

				if (!response.ok) {
					if (response.status === 404) {
						// Session expired
						this.emit(
							'error',
							new Error('Session expired or not found')
						);
						this.stopSharing();
						return;
					}
					throw new Error(`Poll failed: ${response.statusText}`);
				}

				const data: PollResponse = await response.json();

				if (data.timeout) {
					// No request available, continue polling
					continue;
				}

				if (data.request) {
					// Hand the request off to the serializing queue and
					// keep polling immediately. PlaygroundClient is single-
					// threaded — calling handleRequest() concurrently here
					// would dispatch overlapping requests into the same
					// PHP-Wasm runtime, which is not reentrant and ends up
					// deadlocking once WordPress fires its dozen-or-so
					// sub-resource fetches in parallel. queueRequest() runs
					// the handlers one at a time via processQueue().
					this.queueRequest(data.request);
				}
			} catch (error) {
				if ((error as Error).name === 'AbortError') {
					// Polling was intentionally stopped
					break;
				}

				logger.warn('[TunnelHost] Polling error:', error);

				// Brief pause before retrying, but don't give up
				await new Promise((resolve) => setTimeout(resolve, 1000));
				// Keep polling - don't give up on transient errors
			}
		}
	}

	/**
	 * Process an incoming request through the Playground. The signal
	 * fires from stopSharing(); see currentRequestController above for
	 * the why. We check it at every await checkpoint so a torn-down
	 * session never sees its response forwarded back to the relay.
	 */
	private async handleRequest(
		tunnelRequest: TunnelRequest,
		signal: AbortSignal
	): Promise<void> {
		const sessionIdAtStart = this.sessionId;
		try {
			// Convert tunnel request to PHPRequest format
			const phpRequest = {
				method: tunnelRequest.method as any,
				url: tunnelRequest.path,
				headers: tunnelRequest.headers,
				body: tunnelRequest.body
					? new TextEncoder().encode(tunnelRequest.body)
					: undefined,
			};

			// Process through Playground with a timeout to prevent hanging
			const phpResponse = await Promise.race([
				this.playgroundClient.request(phpRequest),
				new Promise<never>((_, reject) =>
					setTimeout(
						() => reject(new Error('PHP request timeout')),
						25000
					)
				),
			]);

			// First abort checkpoint: stopSharing() may have fired while
			// PHP was busy. Drop the response on the floor — we don't
			// own this session any more, and posting to /response/{id}
			// against a torn-down session would either 404 or worse,
			// hit a *new* session if the user started sharing again.
			if (
				signal.aborted ||
				!this.isActive ||
				this.sessionId !== sessionIdAtStart
			) {
				return;
			}

			// Convert headers from Record<string, string[]> to Record<string, string>
			// and rewrite Location headers for redirects to go through the relay
			const responseHeaders: Record<string, string> = {};
			const relayPrefix = `/relay/${this.sessionId}/request`;
			const originalHost = tunnelRequest.headers.host || '';
			for (const [key, values] of Object.entries(phpResponse.headers)) {
				let value = Array.isArray(values) ? values.join(', ') : values;

				// Rewrite Location header for redirects to go through the relay
				if (key.toLowerCase() === 'location' && value) {
					value = rewriteLocationHeader(
						value,
						relayPrefix,
						originalHost
					);
				}

				responseHeaders[key] = value;
			}

			// For HTML and CSS responses, rewrite URLs to go through the
			// relay. The rewriter is a real DOM walk (DOMParser), not a
			// regex sweep — see url-rewriter.ts and its adversarial
			// spec for why that matters.
			let responseBody = phpResponse.bytes;
			const contentType = responseHeaders['content-type'] || '';
			const isHtml = contentType.includes('text/html');
			const isCss = contentType.includes('text/css');

			if ((isHtml || isCss) && this.sessionId) {
				const text = new TextDecoder().decode(phpResponse.bytes);
				const rewriter = createRelayUrlRewriter(
					this.sessionId,
					originalHost
				);
				const rewrittenText = isHtml
					? rewriter.rewriteHtml(text)
					: rewriter.rewriteCss(text);
				responseBody = new TextEncoder().encode(rewrittenText);
			}

			// Build tunnel response
			const tunnelResponse: TunnelResponse = {
				requestId: tunnelRequest.requestId,
				status: phpResponse.httpStatusCode,
				headers: responseHeaders,
				// Encode body as base64 for safe JSON transport
				body: uint8ArrayToBase64(responseBody),
			};

			// Send response back to relay server
			await this.sendResponse(tunnelResponse);

			// Final abort checkpoint: stopSharing() may have fired
			// during sendResponse. Don't notify external listeners
			// about a request that completed against a session the
			// user has already torn down.
			if (
				signal.aborted ||
				!this.isActive ||
				this.sessionId !== sessionIdAtStart
			) {
				return;
			}

			this.emit('requestProcessed', tunnelRequest);
		} catch (error) {
			// Aborted mid-flight: nothing to log, nothing to report.
			if (signal.aborted || !this.isActive) {
				return;
			}
			logger.error('Error processing request:', error);

			// Send error response
			const errorResponse: TunnelResponse = {
				requestId: tunnelRequest.requestId,
				status: 500,
				headers: { 'Content-Type': 'text/plain' },
				body: uint8ArrayToBase64(
					new TextEncoder().encode(
						`Internal Server Error: ${(error as Error).message}`
					)
				),
			};

			await this.sendResponse(errorResponse).catch((sendError) => {
				logger.error(
					'[TunnelHost] Failed to send error response:',
					sendError
				);
			});
		}
	}

	private canHandleAsStaticAsset(tunnelRequest: TunnelRequest): boolean {
		if (tunnelRequest.method !== 'GET' && tunnelRequest.method !== 'HEAD') {
			return false;
		}
		if (tunnelRequest.body) {
			return false;
		}
		const pathname = new URL(tunnelRequest.path, 'https://example.com')
			.pathname;
		if (pathname.includes('..')) {
			return false;
		}
		return getStaticAssetMimeType(pathname) !== null;
	}

	private async handleStaticAssetRequest(
		tunnelRequest: TunnelRequest
	): Promise<void> {
		const sessionIdAtStart = this.sessionId;
		try {
			const pathname = new URL(tunnelRequest.path, 'https://example.com')
				.pathname;
			const documentRoot = normalizePath(
				await this.playgroundClient.documentRoot
			);
			const fsPath = normalizePath(
				joinPaths(documentRoot, removeScopePrefix(pathname))
			);
			if (!fsPath.startsWith(`${documentRoot}/`)) {
				throw new Error(`Refusing to read outside ${documentRoot}`);
			}
			if (!(await this.playgroundClient.isFile(fsPath))) {
				await this.queuePhpFallbackRequest(tunnelRequest);
				return;
			}

			const mimeType =
				getStaticAssetMimeType(pathname) || 'application/octet-stream';
			const body =
				tunnelRequest.method === 'HEAD'
					? new Uint8Array()
					: await this.playgroundClient.readFileAsBuffer(fsPath);

			if (
				!this.isActive ||
				this.sessionId !== sessionIdAtStart ||
				!this.sessionId
			) {
				return;
			}

			await this.sendResponse({
				requestId: tunnelRequest.requestId,
				status: 200,
				headers: {
					'content-type': mimeType,
					'cache-control':
						'no-cache, must-revalidate, max-age=0, no-store, private',
				},
				body: uint8ArrayToBase64(body),
			});
			this.emit('requestProcessed', tunnelRequest);
		} catch (error) {
			logger.warn(
				`[TunnelHost] Static asset fast path failed for ${tunnelRequest.path}:`,
				error
			);
			await this.queuePhpFallbackRequest(tunnelRequest);
		}
	}

	private async queuePhpFallbackRequest(
		tunnelRequest: TunnelRequest
	): Promise<void> {
		this.requestQueue.push(tunnelRequest);
		await this.processQueue();
	}

	/**
	 * Send a response back to the relay server.
	 *
	 * Bails out silently if the host has been torn down between the
	 * caller's last `isActive` check and now. This is the last line
	 * of defence for the stop-sharing race: even if a previous check
	 * was raced past, this one runs *immediately* before the network
	 * call, so we never POST to a stale session URL.
	 */
	private async sendResponse(response: TunnelResponse): Promise<void> {
		if (!this.isActive || !this.sessionId) {
			return;
		}
		const res = await fetch(
			`${this.relayUrl}/relay/${this.sessionId}/response/${response.requestId}`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(response),
			}
		);

		if (!res.ok) {
			logger.error(
				`[TunnelHost] Failed to send response: ${res.statusText}`
			);
			throw new Error(`Failed to send response: ${res.statusText}`);
		}
	}
}

function getStaticAssetMimeType(pathname: string): string | null {
	const extension = pathname.split('.').pop()?.toLowerCase();
	if (!extension || extension === pathname) {
		return null;
	}
	return STATIC_ASSET_MIME_TYPES[extension] || null;
}
