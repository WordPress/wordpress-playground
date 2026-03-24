import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { createServer as createHttpServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { presentStorage } from './tools/tool-definitions';

export interface SiteRegistration {
	slug: string;
	name: string;
	storage: string;
	isActive: boolean;
}

export interface BridgeSiteInfo {
	siteId: string;
	name: string;
	storage: string;
	isActive: boolean;
}

interface RegisterMessage {
	type: 'register';
	tabId: string;
	sites: SiteRegistration[];
}

interface ResponseMessage {
	type: 'response';
	id: string;
	value?: unknown;
	error?: unknown;
}

export interface SiteEntry {
	siteSlug: string;
	siteName: string;
	storage: string;
	reportedByTabs: Set<string>;
	activeInTabs: string[];
}

/**
 * Origins allowed to connect to the WebSocket bridge.
 * Browser-based WebSocket connections include an Origin header
 * that cannot be spoofed by JavaScript, so this prevents
 * drive-by attacks from arbitrary web pages.
 */
const ALLOWED_ORIGIN_PATTERNS = [
	/^https?:\/\/localhost(:\d+)?$/,
	/^https?:\/\/127\.0\.0\.1(:\d+)?$/,
	/^https?:\/\/playground\.wordpress\.net$/,
];

function isAllowedOrigin(origin: string | undefined): boolean {
	// Non-browser clients (e.g. Node.js MCP clients) don't send
	// an Origin header. Allow them — they're local processes.
	if (!origin) {
		return true;
	}
	return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

type SiteActivatedListener = (siteId: string) => void;

export class PlaygroundBridge {
	private connections = new Map<string, WebSocket>();
	private sites = new Map<string, SiteEntry>();
	private pendingRequests = new Map<
		string,
		{
			resolve: (value: unknown) => void;
			reject: (error: Error) => void;
			tabId: string;
		}
	>();
	private requestId = 0;
	private wss: WebSocketServer | undefined;
	private httpServer: ReturnType<typeof createHttpServer> | undefined;
	private sessionToken = randomUUID();
	private siteActivatedListeners: SiteActivatedListener[] = [];

	getPort(): number {
		const addr = this.httpServer?.address() as AddressInfo | null;
		if (!addr) {
			throw new Error('WebSocket server is not running');
		}
		return addr.port;
	}

	startWebSocketServer(port = 0): Promise<WebSocketServer> {
		return new Promise((resolve, reject) => {
			const httpServer = createHttpServer((req, res) => {
				this.handleHttpRequest(req, res);
			});
			this.httpServer = httpServer;

			const wss = new WebSocketServer({
				server: httpServer,
				verifyClient: (
					info: { origin: string; req: IncomingMessage },
					callback: (
						result: boolean,
						code?: number,
						message?: string
					) => void
				) => {
					if (!isAllowedOrigin(info.origin)) {
						console.error(
							`[MCP] Rejected WebSocket connection ` +
								`from origin: ${info.origin}`
						);
						callback(false, 403, 'Forbidden');
						return;
					}

					const url = new URL(
						info.req.url ?? '/',
						`http://${info.req.headers.host}`
					);
					const token = url.searchParams.get('token');
					if (token !== this.sessionToken) {
						console.error(
							'[MCP] Rejected WebSocket connection: ' +
								'invalid token'
						);
						callback(false, 401, 'Invalid token');
						return;
					}

					callback(true);
				},
			});
			this.wss = wss;

			httpServer.on('error', (error: NodeJS.ErrnoException) => {
				if (error.code === 'EADDRINUSE') {
					console.error(
						`[MCP] Port ${port} is already in use. ` +
							`Kill the other process ` +
							`(lsof -i :${port}).`
					);
				}
				reject(error);
			});

			httpServer.listen(port, '127.0.0.1', () => {
				const actualPort = this.getPort();
				console.error(
					`[MCP] WebSocket server listening on ` +
						`ws://127.0.0.1:${actualPort}`
				);
				resolve(wss);
			});

			wss.on('connection', (ws) => {
				this.handleConnection(ws);
			});
		});
	}

	private handleHttpRequest(req: IncomingMessage, res: ServerResponse) {
		if (req.url === '/bridge-token') {
			const origin = req.headers.origin;
			if (!origin || !isAllowedOrigin(origin)) {
				res.writeHead(403);
				res.end('Forbidden');
				return;
			}
			res.setHeader('Access-Control-Allow-Origin', origin);
			res.setHeader('Access-Control-Allow-Methods', 'GET');

			if (req.method === 'OPTIONS') {
				res.writeHead(204);
				res.end();
				return;
			}

			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ token: this.sessionToken }));
			return;
		}
		res.writeHead(404);
		res.end();
	}

	private handleConnection(ws: WebSocket) {
		let tabId: string | undefined;

		ws.on('message', (data) => {
			let message: RegisterMessage | ResponseMessage;
			try {
				message = JSON.parse(data.toString());
			} catch {
				console.error('[MCP] Failed to parse message');
				return;
			}

			try {
				if (message.type === 'register') {
					const isNew = !tabId;
					tabId = message.tabId;
					this.connections.set(tabId, ws);
					this.updateSitesForTab(tabId, message.sites);
					if (isNew) {
						console.error(
							`[MCP] Tab registered: ${tabId} ` +
								`(${message.sites.length} sites)`
						);
					}
					return;
				}

				if (message.type === 'response') {
					const pending = this.pendingRequests.get(message.id);
					if (pending) {
						this.pendingRequests.delete(message.id);
						if (message.error) {
							const errorMsg =
								typeof message.error === 'string'
									? message.error
									: JSON.stringify(message.error);
							pending.reject(new Error(errorMsg));
						} else {
							pending.resolve(message.value);
						}
					}
				}
			} catch (error) {
				console.error('[MCP] Error handling message:', error);
			}
		});

		ws.on('close', () => {
			if (!tabId) {
				return;
			}
			console.error(`[MCP] Tab disconnected: ${tabId}`);

			// Reject pending requests for this tab
			for (const [id, pending] of this.pendingRequests) {
				if (pending.tabId === tabId) {
					pending.reject(new Error('Browser tab disconnected'));
					this.pendingRequests.delete(id);
				}
			}

			this.connections.delete(tabId);

			// Remove tab from all sites and clean up orphans
			for (const [siteId, site] of this.sites) {
				site.reportedByTabs.delete(tabId);
				const idx = site.activeInTabs.indexOf(tabId);
				if (idx !== -1) {
					site.activeInTabs.splice(idx, 1);
				}
				if (site.reportedByTabs.size === 0) {
					this.sites.delete(siteId);
				}
			}
		});
	}

	private updateSitesForTab(
		tabId: string,
		registeredSites: SiteRegistration[]
	) {
		const tabSiteSlugs = new Set(registeredSites.map((s) => s.slug));

		// Remove this tab from sites it no longer reports
		for (const [siteId, site] of this.sites) {
			if (!tabSiteSlugs.has(site.siteSlug)) {
				site.reportedByTabs.delete(tabId);
				const idx = site.activeInTabs.indexOf(tabId);
				if (idx !== -1) {
					site.activeInTabs.splice(idx, 1);
				}
				if (site.reportedByTabs.size === 0) {
					this.sites.delete(siteId);
				}
			}
		}

		// Add/update sites from this tab's registration
		for (const reg of registeredSites) {
			const siteId = reg.slug;

			let site = this.sites.get(siteId);
			if (!site) {
				site = {
					siteSlug: reg.slug,
					siteName: reg.name,
					storage: reg.storage,
					reportedByTabs: new Set(),
					activeInTabs: [],
				};
				this.sites.set(siteId, site);
			}

			// Update name and storage in case they changed
			site.siteName = reg.name;
			site.storage = reg.storage;
			site.reportedByTabs.add(tabId);

			if (reg.isActive) {
				const wasActive = site.activeInTabs.length > 0;

				// activeInTabs is ordered most-recently-active first.
				// sendCommand() always targets activeInTabs[0],
				// so move this tab to the front.
				const idx = site.activeInTabs.indexOf(tabId);
				if (idx !== -1) {
					site.activeInTabs.splice(idx, 1);
				}
				site.activeInTabs.unshift(tabId);

				if (!wasActive) {
					for (const listener of this.siteActivatedListeners) {
						listener(siteId);
					}
				}
			} else {
				// Remove this tab from activeInTabs if it was there
				const idx = site.activeInTabs.indexOf(tabId);
				if (idx !== -1) {
					site.activeInTabs.splice(idx, 1);
				}
			}
		}
	}

	sendCommand(
		siteId: string,
		method: string,
		args: unknown[] = []
	): Promise<unknown> {
		const site = this.sites.get(siteId);
		if (!site) {
			return Promise.reject(new Error(`Unknown site: ${siteId}`));
		}

		const isBrowserCommand = method.startsWith('__');
		let targetTabId: string;

		if (isBrowserCommand) {
			// Browser-level commands (e.g. __open_site, __rename_site)
			// don't require the site to be active — just any connected
			// tab, preferring one that reported this site.
			if (this.connections.size === 0) {
				return Promise.reject(new Error('No browser tabs connected'));
			}
			const reportingTabId = [...site.reportedByTabs].find((id) =>
				this.connections.has(id)
			);
			targetTabId =
				reportingTabId ?? this.connections.keys().next().value!;
		} else {
			// Site-level commands target the Playground client inside
			// the iframe, so the site must be active in a tab.
			if (site.activeInTabs.length === 0) {
				return Promise.reject(
					new Error(
						`Site "${site.siteName}" (${siteId}) is not ` +
							`active in any tab. Use open_site to ` +
							`activate it.`
					)
				);
			}
			targetTabId = site.activeInTabs[0];
		}

		const ws = this.connections.get(targetTabId);
		if (!ws) {
			return Promise.reject(new Error('Target browser tab disconnected'));
		}

		const id = String(++this.requestId);
		return new Promise((resolve, reject) => {
			const timeoutMs = 300_000;
			const timeout = setTimeout(() => {
				this.pendingRequests.delete(id);
				reject(
					new Error(
						`Command "${method}" timed out after ${timeoutMs / 1000} seconds`
					)
				);
			}, timeoutMs);
			this.pendingRequests.set(id, {
				resolve: (value: unknown) => {
					clearTimeout(timeout);
					resolve(value);
				},
				reject: (error: Error) => {
					clearTimeout(timeout);
					reject(error);
				},
				tabId: targetTabId,
			});
			ws.send(
				JSON.stringify({
					id,
					type: 'command',
					method,
					args,
					siteSlug: site.siteSlug,
				})
			);
		});
	}

	waitForSiteActive(siteId: string, timeoutMs: number): Promise<SiteEntry> {
		const site = this.sites.get(siteId);
		if (site && site.activeInTabs.length > 0) {
			return Promise.resolve(site);
		}

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.removeSiteActivatedListener(handler);
				reject(
					new Error(
						`Timed out waiting for site ${siteId} to become active`
					)
				);
			}, timeoutMs);

			const handler = (activatedSiteId: string) => {
				if (activatedSiteId === siteId) {
					clearTimeout(timeout);
					this.removeSiteActivatedListener(handler);
					resolve(this.sites.get(siteId)!);
				}
			};

			this.siteActivatedListeners.push(handler);
		});
	}

	private removeSiteActivatedListener(listener: SiteActivatedListener) {
		const idx = this.siteActivatedListeners.indexOf(listener);
		if (idx !== -1) {
			this.siteActivatedListeners.splice(idx, 1);
		}
	}

	listSites(): BridgeSiteInfo[] {
		return [...this.sites.entries()].map(([siteId, site]) => ({
			siteId,
			name: site.siteName,
			storage: presentStorage(site.storage),
			isActive: site.activeInTabs.length > 0,
		}));
	}

	getTabCount(): number {
		return this.connections.size;
	}

	isConnected(): boolean {
		return this.connections.size > 0;
	}

	async close(): Promise<void> {
		if (this.wss) {
			for (const client of this.wss.clients) {
				client.close();
			}
		}
		return new Promise<void>((resolve) => {
			const closeHttp = () => {
				if (this.httpServer) {
					this.httpServer.close(() => resolve());
				} else {
					resolve();
				}
			};
			if (this.wss) {
				this.wss.close(() => closeHttp());
			} else {
				closeHttp();
			}
		});
	}
}
