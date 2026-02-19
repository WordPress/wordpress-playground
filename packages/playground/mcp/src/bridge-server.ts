import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';

export interface SiteRegistration {
	slug: string;
	name: string;
	storage: string;
	isActive: boolean;
}

export interface SiteInfo {
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

interface SiteEntry {
	siteSlug: string;
	siteName: string;
	storage: string;
	reportedByTabs: Set<string>;
	activeInTabs: string[];
}

export const DEFAULT_WS_PORT = 7999;

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
	private siteActivatedListeners: SiteActivatedListener[] = [];

	startWebSocketServer(port = DEFAULT_WS_PORT): Promise<WebSocketServer> {
		return new Promise((resolve, reject) => {
			const wss = new WebSocketServer({ port });
			this.wss = wss;

			wss.on('error', (error: NodeJS.ErrnoException) => {
				if (error.code === 'EADDRINUSE') {
					// TODO: How can users change the port? Can we do it automatically?
					console.error(
						`[MCP] Port ${port} is already in use. ` +
							`Kill the other process (lsof -i :${port}) or ` +
							`change WS_PORT.`
					);
				}
				reject(error);
			});

			wss.on('listening', () => {
				console.error(
					`[MCP] WebSocket server listening on ws://127.0.0.1:${port}`
				);
				resolve(wss);
			});

			wss.on('connection', (ws) => {
				this.handleConnection(ws);
			});
		});
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
				// sendCommandToSite() always targets activeInTabs[0],
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

	sendCommandToSite(
		siteId: string,
		method: string,
		args: unknown[] = []
	): Promise<unknown> {
		const site = this.sites.get(siteId);
		if (!site) {
			return Promise.reject(new Error(`Unknown site: ${siteId}`));
		}
		if (site.activeInTabs.length === 0) {
			return Promise.reject(
				new Error(
					`Site "${site.siteName}" (${siteId}) is not ` +
						`active in any tab. Use open_site to activate it.`
				)
			);
		}

		const targetTabId = site.activeInTabs[0];
		const ws = this.connections.get(targetTabId);
		if (!ws) {
			return Promise.reject(new Error('Target browser tab disconnected'));
		}

		const id = String(++this.requestId);
		return new Promise((resolve, reject) => {
			this.pendingRequests.set(id, {
				resolve,
				reject,
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

	sendCommandToBrowser(
		siteId: string,
		method: string,
		args: unknown[] = []
	): Promise<unknown> {
		const site = this.sites.get(siteId);
		if (!site) {
			return Promise.reject(new Error(`Unknown site: ${siteId}`));
		}

		if (this.connections.size === 0) {
			return Promise.reject(new Error('No browser tabs connected'));
		}

		// Prefer a tab that actually reported this site so the
		// browser-side Redux store is guaranteed to contain it.
		const reportingTabId = [...site.reportedByTabs].find((id) =>
			this.connections.has(id)
		);
		const targetTabId =
			reportingTabId ?? this.connections.keys().next().value!;
		const ws = this.connections.get(targetTabId)!;

		const id = String(++this.requestId);
		return new Promise((resolve, reject) => {
			this.pendingRequests.set(id, {
				resolve,
				reject,
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

	listSites(): SiteInfo[] {
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
			if (this.wss) {
				this.wss.close(() => resolve());
			} else {
				resolve();
			}
		});
	}
}

/**
 * Translate internal Playground storage types to MCP-facing names.
 *
 * Playground uses 'none' for temporary sites — we translate that to
 * 'temporary' so MCP clients can tell at a glance that the site
 * will be lost on reload. Other values (e.g. 'opfs') pass through
 * unchanged.
 */
export function presentStorage(raw: string): string {
	switch (raw) {
		case 'none':
			return 'temporary';
		default:
			return raw;
	}
}
