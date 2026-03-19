import type { PlaygroundClient } from '@wp-playground/remote';
import { createToolClient } from './tools/tool-executors';
import type { ToolClient } from './tools/tool-executors';

/**
 * Shared configuration for the MCP bridge client and WebMCP.
 *
 * Both transports need the same callbacks to interact with
 * the Playground site list and active client.
 */
export interface PlaygroundConfig {
	getSites: () => Array<{
		slug: string;
		name: string;
		storage: string;
		isActive: boolean;
	}>;
	getPlaygroundClient: (siteSlug: string) => PlaygroundClient | undefined;
	renameSite?: (siteSlug: string, newName: string) => Promise<void>;
	saveSite?: (siteSlug: string) => Promise<{ slug: string; storage: string }>;
	onConnect?: () => void;
}

export interface McpBridgeHandle {
	notifySitesChanged: () => void;
	stop: () => void;
}

const RECONNECT_INTERVAL_MS = 5000;

export function startMcpBridge(
	config: PlaygroundConfig,
	port: number
): McpBridgeHandle {
	const tabId = crypto.randomUUID();
	let ws: WebSocket | null = null;
	let previousSitesSerialized = '';
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let stopped = false;

	function sendSitesRegistration(socket: WebSocket) {
		const sites = config.getSites();
		const serialized = JSON.stringify(sites);
		if (serialized === previousSitesSerialized) {
			return;
		}
		previousSitesSerialized = serialized;
		socket.send(JSON.stringify({ type: 'register', tabId, sites }));
	}

	async function connect() {
		try {
			const response = await fetch(
				`http://127.0.0.1:${port}/bridge-token`
			);
			if (!response.ok) {
				scheduleReconnect();
				return;
			}
			const { token } = await response.json();
			ws = new WebSocket(`ws://127.0.0.1:${port}?token=${token}`);
		} catch {
			scheduleReconnect();
			return;
		}

		ws.addEventListener('open', () => {
			previousSitesSerialized = '';
			sendSitesRegistration(ws!);
			config.onConnect?.();
		});

		ws.addEventListener('message', async (event) => {
			let message;
			try {
				message = JSON.parse(event.data as string);
			} catch {
				return;
			}
			if (message.type !== 'command') {
				return;
			}

			const { id, method, args, siteSlug } = message;
			try {
				const value = await handleCommand(
					config,
					method,
					args || [],
					siteSlug,
					port
				);
				if (ws?.readyState === WebSocket.OPEN) {
					ws.send(JSON.stringify({ id, type: 'response', value }));
				}
			} catch (error) {
				const errorMsg =
					error instanceof Error ? error.message : String(error);
				if (ws?.readyState === WebSocket.OPEN) {
					ws.send(
						JSON.stringify({
							id,
							type: 'response',
							error: errorMsg,
						})
					);
				}
			}
		});

		ws.addEventListener('close', () => {
			ws = null;
			scheduleReconnect();
		});

		ws.addEventListener('error', () => {
			// Error will be followed by close event,
			// which handles reconnect
		});
	}

	function scheduleReconnect() {
		if (stopped) {
			return;
		}
		reconnectTimer = setTimeout(connect, RECONNECT_INTERVAL_MS);
	}

	connect();

	return {
		notifySitesChanged: () => {
			if (ws?.readyState === WebSocket.OPEN) {
				sendSitesRegistration(ws);
			}
		},
		stop: () => {
			stopped = true;
			if (reconnectTimer !== null) {
				clearTimeout(reconnectTimer);
				reconnectTimer = null;
			}
			if (ws) {
				ws.close();
				ws = null;
			}
		},
	};
}

async function handleCommand(
	config: PlaygroundConfig,
	method: string,
	args: unknown[],
	siteSlug: string,
	port: number
): Promise<unknown> {
	if (method === '__open_site') {
		const url = new URL(window.location.href);
		url.searchParams.set('mcp', 'yes');
		url.searchParams.set('mcp-port', String(port));
		url.searchParams.set('site-slug', siteSlug);
		const newWindow = window.open(url.toString(), '_blank');
		if (!newWindow) {
			throw new Error(
				'Pop-up blocked by browser. The user ' +
					'must allow pop-ups for this site.'
			);
		}
		return true;
	}

	if (method === '__rename_site') {
		if (!config.renameSite) {
			throw new Error('renameSite not configured');
		}
		const [newName] = args as [string];
		await config.renameSite(siteSlug, newName);
		return true;
	}

	if (method === '__save_site') {
		if (!config.saveSite) {
			throw new Error('saveSite not configured');
		}
		return await config.saveSite(siteSlug);
	}

	const playgroundClient = config.getPlaygroundClient(siteSlug);
	if (!playgroundClient) {
		throw new Error(`No active client for site: ${siteSlug}`);
	}

	const client = createToolClient(playgroundClient);
	const fn = client[method as keyof ToolClient];
	if (typeof fn !== 'function') {
		throw new Error(`Unknown method: ${method}`);
	}
	return await (fn as (...a: unknown[]) => Promise<unknown>)(...args);
}
