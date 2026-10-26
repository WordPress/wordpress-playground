import { afterEach, describe, expect, it, vi } from 'vitest';
import { startMcpBridge } from '../../src/bridge-client';
import type {
	McpBridgeHandle,
	PlaygroundBridgeConfig,
} from '../../src/bridge-client';

describe('browser MCP GitHub export', () => {
	let handle: McpBridgeHandle;
	const sockets: TestWebSocket[] = [];

	class TestWebSocket extends EventTarget {
		static OPEN = 1;
		readyState = TestWebSocket.OPEN;
		sent: string[] = [];
		constructor() {
			super();
			sockets.push(this);
		}
		send(data: string) {
			this.sent.push(data);
		}
		close() {}
	}

	afterEach(() => {
		handle?.stop();
		vi.unstubAllGlobals();
	});

	it('dispatches validated options to the active site host', async () => {
		const result = {
			url: 'https://github.com/owner/repo/pull/1',
			forked: false,
		};
		const exportToGithub = vi.fn().mockResolvedValue(result);
		const response = await sendExport(true, exportToGithub, {
			baseBranch: 'main',
		});
		expect(exportToGithub).toHaveBeenCalledWith({ baseBranch: 'main' });
		expect(response).toEqual({ id: '1', type: 'response', value: result });
	});

	it('rejects an export if the target site became inactive', async () => {
		const exportToGithub = vi.fn();
		const response = await sendExport(false, exportToGithub, {});
		expect(response.error).toBe('Site is no longer active: target');
		expect(exportToGithub).not.toHaveBeenCalled();
	});

	it('reports unsupported hosts', async () => {
		const response = await sendExport(true, undefined, {});
		expect(response.error).toBe(
			'GitHub export is not supported by this Playground host.'
		);
	});

	async function sendExport(
		isActive: boolean,
		exportToGithub: PlaygroundBridgeConfig['exportToGithub'],
		options: Record<string, unknown>
	) {
		sockets.length = 0;
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValue(
					new Response(JSON.stringify({ token: 'test' }))
				)
		);
		vi.stubGlobal('WebSocket', TestWebSocket);
		handle = startMcpBridge(
			{
				list: () => [
					{
						slug: 'target',
						name: 'Target',
						storage: 'temporary',
						isActive,
					},
				],
				getClient: () => undefined,
				rename: vi.fn(),
				saveInBrowser: vi.fn(),
				exportToGithub,
			},
			7999
		);
		await vi.waitFor(() => expect(sockets).toHaveLength(1));
		const connection = sockets[0];
		if (!connection) {
			throw new Error('WebSocket did not connect');
		}
		connection.dispatchEvent(
			new MessageEvent('message', {
				data: JSON.stringify({
					id: '1',
					type: 'command',
					method: 'exportToGithub',
					args: [options],
					siteSlug: 'target',
				}),
			})
		);
		await vi.waitFor(() => expect(connection.sent).toHaveLength(1));
		return JSON.parse(connection.sent[0]);
	}
});
