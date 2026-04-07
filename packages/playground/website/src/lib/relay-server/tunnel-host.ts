/**
 * TunnelHost manages a sharing session where this browser acts as the host.
 *
 * The host polls the relay server for incoming guest requests, processes them
 * through the local Playground instance, and sends responses back.
 */

import { logger } from '@php-wasm/logger';
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
		this.isActive = false;
		this.pollAbortController?.abort();
		this.pollAbortController = null;
		this.sessionId = null;
		this.shareUrl = null;
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
					navigator.sendBeacon(url, new Blob([], { type: 'text/plain' }));
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
			try {
				await this.handleRequest(request);
			} catch (error) {
				logger.error(
					`[TunnelHost] Error handling request ${request.requestId}:`,
					error
				);
				this.emit('error', error as Error);
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
			(this.listeners[event] as Set<TunnelHostEvents[K]> | undefined)?.delete(
				listener
			);
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
					// Process request in background - don't wait, keep polling
					this.handleRequest(data.request).catch((error) => {
						logger.error(
							'[TunnelHost] Error handling request:',
							error
						);
					});
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
	 * Process an incoming request through the Playground.
	 */
	private async handleRequest(tunnelRequest: TunnelRequest): Promise<void> {
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

	/**
	 * Send a response back to the relay server.
	 */
	private async sendResponse(response: TunnelResponse): Promise<void> {
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
