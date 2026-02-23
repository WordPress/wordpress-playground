import type { PlaygroundClient } from '@wp-playground/remote';
import type {
	PHPRunOptions,
	PHPRequest,
	ListFilesOptions,
	RmDirOptions,
} from '@php-wasm/universal';
import type { SiteRegistration } from './bridge-server';

export interface BridgeClientConfig {
	getSites: () => SiteRegistration[];
	getPlaygroundClient: (siteSlug: string) => PlaygroundClient | undefined;
	renameSite?: (siteSlug: string, newName: string) => Promise<void>;
	saveSite?: (siteSlug: string) => Promise<{ slug: string; storage: string }>;
}

export interface McpBridgeHandle {
	notifySitesChanged: () => void;
}

const DEFAULT_MCP_WS_PORT = 7999;
const RECONNECT_INTERVAL_MS = 5000;

const tabId = crypto.randomUUID();

export function startMcpBridge(config: BridgeClientConfig): McpBridgeHandle {
	let ws: WebSocket | null = null;
	let previousSitesSerialized = '';

	function sendSitesRegistration(socket: WebSocket) {
		const sites = config.getSites();
		const serialized = JSON.stringify(sites);
		if (serialized === previousSitesSerialized) {
			return;
		}
		previousSitesSerialized = serialized;
		socket.send(JSON.stringify({ type: 'register', tabId, sites }));
	}

	function connect() {
		const params = new URLSearchParams(window.location.search);
		const port = params.get('mcpPort') ?? String(DEFAULT_MCP_WS_PORT);

		try {
			ws = new WebSocket(`ws://127.0.0.1:${port}`);
		} catch {
			scheduleReconnect();
			return;
		}

		ws.addEventListener('open', () => {
			previousSitesSerialized = '';
			sendSitesRegistration(ws!);
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
					siteSlug
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
		setTimeout(connect, RECONNECT_INTERVAL_MS);
	}

	connect();

	return {
		notifySitesChanged: () => {
			if (ws?.readyState === WebSocket.OPEN) {
				sendSitesRegistration(ws);
			}
		},
	};
}

async function handleCommand(
	config: BridgeClientConfig,
	method: string,
	args: unknown[],
	siteSlug: string
): Promise<unknown> {
	if (method === '__open_site') {
		const url = new URL(window.location.href);
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

	const client = config.getPlaygroundClient(siteSlug);
	if (!client) {
		throw new Error(`No active client for site: ${siteSlug}`);
	}

	switch (method) {
		case 'goTo': {
			const [path] = args as [string];
			return await client.goTo(path);
		}
		case 'getCurrentURL':
			return await client.getCurrentURL();
		case 'run': {
			const [options] = args as [PHPRunOptions];
			return await client.run(options);
		}
		case 'request': {
			const [request] = args as [PHPRequest];
			return await client.request(request);
		}
		case 'readFileAsText': {
			const [path] = args as [string];
			return await client.readFileAsText(path);
		}
		case 'writeFile': {
			const [path, contents] = args as [string, string | Uint8Array];
			return await client.writeFile(path, contents);
		}
		case 'listFiles': {
			const [path, options] = args as [string, ListFilesOptions?];
			return await client.listFiles(path, options);
		}
		case 'mkdirTree': {
			const [path] = args as [string];
			return await client.mkdirTree(path);
		}
		case 'unlink': {
			const [path] = args as [string];
			return await client.unlink(path);
		}
		case 'rmdir': {
			const [path, options] = args as [string, RmDirOptions?];
			return await client.rmdir(path, options);
		}
		case 'fileExists': {
			const [path] = args as [string];
			return await client.fileExists(path);
		}
		default:
			throw new Error(`Unknown method: ${method}`);
	}
}
