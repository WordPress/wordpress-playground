/**
 * TunnelHost manages a sharing session where this browser acts as the host.
 *
 * The host polls the relay server for incoming guest requests, processes them
 * through the local Playground instance, and sends responses back.
 */

import type { PlaygroundClient } from '@wp-playground/remote';
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

/**
 * Rewrite absolute URLs in HTML content to go through the relay tunnel.
 *
 * WordPress generates URLs with absolute paths like /wp-content/..., /wp-admin/..., etc.
 * When a guest views the shared Playground in a different browser, these paths
 * would bypass the relay and fail. This function rewrites them to go through
 * the relay endpoint.
 */
function rewriteUrlsForRelay(
	html: string,
	sessionId: string,
	originalHost: string
): string {
	const relayPrefix = `/relay/${sessionId}/request`;

	// Rewrite absolute paths in common HTML attributes
	// Matches: href="/...", src="/...", action="/...", etc.
	// But not: href="//..." (protocol-relative) or href="http..." (full URLs handled separately)
	let result = html.replace(
		/((?:href|src|action|data-src|poster|srcset)=["'])\/(?!\/|relay\/)/gi,
		`$1${relayPrefix}/`
	);

	// Rewrite full URLs that point to the original host
	// e.g., http://localhost:5400/wp-content/... → /relay/SESSION_ID/request/wp-content/...
	if (originalHost) {
		const hostPattern = new RegExp(
			`(["'])https?://${escapeRegExp(originalHost)}(/[^"'\\s]*)`,
			'gi'
		);
		result = result.replace(hostPattern, `$1${relayPrefix}$2`);
	}

	// Rewrite absolute paths in inline CSS url() values
	// Matches: url(/wp-content/...) or url('/wp-content/...')
	result = result.replace(
		/url\((['"]?)\/(?!\/|relay\/)/gi,
		`url($1${relayPrefix}/`
	);

	// Rewrite absolute paths in srcset attributes (which have special format)
	// srcset="/image.jpg 1x, /image-2x.jpg 2x"
	result = result.replace(
		/srcset=["']([^"']+)["']/gi,
		(match, srcsetValue: string) => {
			const rewritten = srcsetValue.replace(
				/(?:^|,\s*)\/(?!\/|relay\/)/g,
				(m) => m.replace('/', `${relayPrefix}/`)
			);
			return `srcset="${rewritten}"`;
		}
	);

	return result;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegExp(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Rewrite absolute URLs in CSS content to go through the relay tunnel.
 */
function rewriteCssUrlsForRelay(css: string, sessionId: string): string {
	const relayPrefix = `/relay/${sessionId}/request`;

	// Rewrite url() values with absolute paths
	// Matches: url(/path), url('/path'), url("/path")
	return css.replace(
		/url\((['"]?)\/(?!\/|relay\/)/gi,
		`url($1${relayPrefix}/`
	);
}

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

export class TunnelHost {
	private sessionId: string | null = null;
	private shareUrl: string | null = null;
	private pollAbortController: AbortController | null = null;
	private isActive = false;
	private status: TunnelHostStatus = 'disconnected';
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 1000;
	private listeners: Map<keyof TunnelHostEvents, Set<Function>> = new Map();

	/**
	 * Queue of pending requests to process sequentially.
	 * PlaygroundClient can only handle one request at a time (single-threaded PHP),
	 * so we need to queue requests to avoid overwhelming it.
	 */
	private requestQueue: TunnelRequest[] = [];
	private isProcessingRequest = false;

	constructor(
		private playgroundClient: PlaygroundClient,
		private relayUrl: string
	) {}

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
			this.isActive = true;
			this.reconnectAttempts = 0;

			this.setStatus('connected');
			this.startPolling();

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
		this.isActive = false;
		this.pollAbortController?.abort();
		this.pollAbortController = null;
		this.sessionId = null;
		this.shareUrl = null;
		this.requestQueue = [];
		this.isProcessingRequest = false;
		this.setStatus('disconnected');
	}

	/**
	 * Add a request to the processing queue.
	 * Requests are processed sequentially since PlaygroundClient is single-threaded.
	 */
	private queueRequest(request: TunnelRequest): void {
		this.requestQueue.push(request);
		this.processQueue();
	}

	/**
	 * Process queued requests one at a time.
	 */
	private async processQueue(): Promise<void> {
		if (this.isProcessingRequest) {
			console.log('[TunnelHost] Queue processor already running, request will be processed in turn');
			return;
		}
		if (this.requestQueue.length === 0) {
			return;
		}

		this.isProcessingRequest = true;
		console.log('[TunnelHost] Starting queue processor');

		while (this.requestQueue.length > 0 && this.isActive) {
			const request = this.requestQueue.shift()!;
			console.log(`[TunnelHost] Processing request ${request.requestId} for ${request.path}, queue length: ${this.requestQueue.length}`);
			try {
				await this.handleRequest(request);
				console.log(`[TunnelHost] Completed request ${request.requestId}`);
			} catch (error) {
				console.error(`[TunnelHost] Error handling request ${request.requestId}:`, error);
				this.emit('error', error as Error);
			}
		}

		console.log('[TunnelHost] Queue processor finished');
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
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event)!.add(listener);
		return () => this.listeners.get(event)?.delete(listener);
	}

	private emit<K extends keyof TunnelHostEvents>(
		event: K,
		...args: Parameters<TunnelHostEvents[K]>
	): void {
		this.listeners.get(event)?.forEach((listener) => {
			try {
				(listener as Function)(...args);
			} catch (e) {
				console.error('Error in event listener:', e);
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
		console.log('[TunnelHost] Starting polling loop');
		while (this.isActive && this.sessionId) {
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
						console.log('[TunnelHost] Session expired or not found');
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

				// Reset reconnect counter on successful poll
				this.reconnectAttempts = 0;

				if (data.timeout) {
					// No request available, continue polling
					console.log('[TunnelHost] Poll timeout, continuing...');
					continue;
				}

				if (data.request) {
					console.log(`[TunnelHost] Received request ${data.request.requestId} for ${data.request.path}`);
					// Process request in background - don't wait, keep polling
					this.handleRequest(data.request).catch((error) => {
						console.error(`[TunnelHost] Error handling request:`, error);
					});
				}
			} catch (error) {
				if ((error as Error).name === 'AbortError') {
					// Polling was intentionally stopped
					console.log('[TunnelHost] Polling aborted');
					break;
				}

				console.error('[TunnelHost] Polling error:', error);

				// Brief pause before retrying, but don't give up
				await new Promise((resolve) => setTimeout(resolve, 1000));
				// Keep polling - don't give up on transient errors
			}
		}
		console.log('[TunnelHost] Polling loop exited, isActive:', this.isActive);
	}

	/**
	 * Process an incoming request through the Playground.
	 */
	private async handleRequest(tunnelRequest: TunnelRequest): Promise<void> {
		const startTime = Date.now();
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

			console.log(`[TunnelHost] Calling playgroundClient.request for ${tunnelRequest.path}`);
			// Process through Playground with a timeout to prevent hanging
			const phpResponse = await Promise.race([
				this.playgroundClient.request(phpRequest),
				new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error('PHP request timeout')), 25000)
				),
			]);
			console.log(`[TunnelHost] playgroundClient.request completed in ${Date.now() - startTime}ms, status: ${phpResponse.httpStatusCode}`);

			// Convert headers from Record<string, string[]> to Record<string, string>
			// and rewrite Location headers for redirects to go through the relay
			const responseHeaders: Record<string, string> = {};
			const relayPrefix = `/relay/${this.sessionId}/request`;
			for (const [key, values] of Object.entries(phpResponse.headers)) {
				let value = Array.isArray(values) ? values.join(', ') : values;

				// Rewrite Location header for redirects to go through the relay
				if (key.toLowerCase() === 'location' && value) {
					if (value.startsWith('/') && !value.startsWith('/relay/')) {
						value = `${relayPrefix}${value}`;
						console.log(`[TunnelHost] Rewrote Location header to: ${value}`);
					}
				}

				responseHeaders[key] = value;
			}

			// For HTML and CSS responses, rewrite URLs to go through the relay
			// This is essential for cross-browser sharing where the guest can't
			// access the host's Playground directly
			let responseBody = phpResponse.bytes;
			const contentType = responseHeaders['content-type'] || '';
			const isHtml = contentType.includes('text/html');
			const isCss = contentType.includes('text/css');

			if ((isHtml || isCss) && this.sessionId) {
				const text = new TextDecoder().decode(phpResponse.bytes);
				const originalHost = tunnelRequest.headers.host || '';
				const rewrittenText = isHtml
					? rewriteUrlsForRelay(text, this.sessionId, originalHost)
					: rewriteCssUrlsForRelay(text, this.sessionId);
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

			this.emit('requestProcessed', tunnelRequest);
		} catch (error) {
			console.error('Error processing request:', error);

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

			await this.sendResponse(errorResponse).catch(console.error);
		}
	}

	/**
	 * Send a response back to the relay server.
	 */
	private async sendResponse(response: TunnelResponse): Promise<void> {
		console.log(`[TunnelHost] Sending response for ${response.requestId}`);
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
			console.error(`[TunnelHost] Failed to send response: ${res.statusText}`);
			throw new Error(`Failed to send response: ${res.statusText}`);
		}
		console.log(`[TunnelHost] Response sent successfully for ${response.requestId}`);
	}
}
