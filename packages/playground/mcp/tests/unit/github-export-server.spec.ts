import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { PlaygroundBridge } from '../../src/bridge-server';
import { registerMcpServerTools } from '../../src/tools/register-mcp-server-tools';

describe('MCP GitHub export', () => {
	let client: Client;
	let server: McpServer;
	const sendCommand = vi.fn();

	beforeEach(async () => {
		sendCommand.mockReset();
		server = new McpServer({ name: 'test', version: '1.0.0' });
		registerMcpServerTools(
			server,
			{ sendCommand } as unknown as PlaygroundBridge,
			7999
		);
		client = new Client({ name: 'test', version: '1.0.0' });
		const [clientTransport, serverTransport] =
			InMemoryTransport.createLinkedPair();
		await server.connect(serverTransport);
		await client.connect(clientTransport);
	});

	afterEach(async () => {
		await client.close();
		await server.close();
	});

	it('forwards the site and comparison/base-branch settings and returns the PR result', async () => {
		const result = {
			url: 'https://github.com/owner/repo/pull/1',
			forked: true,
		};
		sendCommand.mockResolvedValue(result);
		const options = {
			repoUrl: 'https://github.com/owner/repo/tree/dist/main',
			baseBranch: 'main',
			contentType: 'custom-paths',
			fromPlaygroundRoot: '/wordpress/wp-content/plugins/demo',
			relativeExportPaths: ['.'],
			toPathInRepo: '/',
		};
		const response = await client.callTool({
			name: 'playground_export_to_github',
			arguments: { siteId: 'tab/site', ...options },
		});
		expect(sendCommand).toHaveBeenCalledWith('tab/site', 'exportToGithub', [
			options,
		]);
		expect(response).toMatchObject({
			content: [{ type: 'text', text: JSON.stringify(result) }],
		});
	});

	it('preserves omitted options for browser launch defaults', async () => {
		sendCommand.mockResolvedValue({
			url: 'https://github.com/owner/repo/pull/1',
			forked: false,
		});
		await client.callTool({
			name: 'playground_export_to_github',
			arguments: { siteId: 'tab/site' },
		});
		expect(sendCommand).toHaveBeenCalledWith('tab/site', 'exportToGithub', [
			{},
		]);
	});

	it.each([
		{},
		{ siteId: 'tab/site', baseBranch: 42 },
		{ siteId: 'tab/site', contentType: 'unknown' },
	])('rejects invalid MCP input before dispatch: %j', async (input) => {
		const result = await client.callTool({
			name: 'playground_export_to_github',
			arguments: input,
		});
		expect(result.isError).toBe(true);
		expect(sendCommand).not.toHaveBeenCalled();
	});

	it('reports authentication or routing failures as MCP errors', async () => {
		sendCommand.mockRejectedValue(
			new Error('GitHub authentication is required.')
		);
		const response = await client.callTool({
			name: 'playground_export_to_github',
			arguments: { siteId: 'tab/site' },
		});
		expect(response).toMatchObject({
			isError: true,
			content: [
				{
					type: 'text',
					text: 'GitHub export failed: GitHub authentication is required.',
				},
			],
		});
	});
});
