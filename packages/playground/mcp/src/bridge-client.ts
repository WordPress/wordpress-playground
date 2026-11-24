import type { PlaygroundClient } from '@wp-playground/remote';
import { createToolClient } from './tools/tool-executors';
import type { ToolClient } from './tools/tool-executors';

/**
 * Configuration accepted by `startMcpBridge`. Only includes the
 * methods the bridge actually calls — callers can pass any wider
 * object (e.g. the full site-management API) and TypeScript will
 * accept it structurally.
 */
export interface PlaygroundBridgeConfig {
	list(): Array<{
		slug: string;
		name: string;
		storage: string;
		isActive: boolean;
	}>;
	getClient(): PlaygroundClient | undefined;
	rename(newName: string): Promise<void>;
	saveInBrowser(): Promise<{ slug: string; storage: string }>;
	onConnect?: () => void;
}

export interface McpBridgeHandle {
	notifySitesChanged: () => void;
	stop: () => void;
}

const RECONNECT_INTERVAL_MS = 5000;

export function startMcpBridge(
	config: PlaygroundBridgeConfig,
	port: number
): McpBridgeHandle {
	const tabId = crypto.randomUUID();
	let ws: WebSocket | null = null;
	let previousSitesSerialized = '';
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let stopped = false;

	function sendSitesRegistration(socket: WebSocket) {
		const sites = config.list();
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
	config: PlaygroundBridgeConfig,
	method: string,
	args: unknown[],
	siteSlug: string,
	port: number
): Promise<unknown> {
	if (method === '__open_site_in_new_tab') {
		const url = new URL(window.location.href);
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
		const [newName] = args as [string];
		await config.rename(newName);
		return true;
	}

	if (method === '__save_site') {
		return await config.saveInBrowser();
	}

	const playgroundClient = config.getClient();
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
