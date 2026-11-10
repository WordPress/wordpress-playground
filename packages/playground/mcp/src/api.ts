import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { PlaygroundBridge } from './bridge-server';
import { createServer } from './mcp-server';
import { registerMcpServerTools } from './tools/register-mcp-server-tools';
import type { McpServerExtension, McpServerDefinition } from './mcp-server';
import type { McpServerToolRegistrar } from './tools/register-mcp-server-tools';

export { PlaygroundBridge } from './bridge-server';
export { createServer } from './mcp-server';
export { playgroundMcpProfile } from './playground-mcp-profile';
export { registerMcpServerTools } from './tools/register-mcp-server-tools';
export type {
	McpServerDefinition,
	McpServerExtension,
	McpServerPromptDefinition,
} from './mcp-server';
export type { McpServerToolRegistrar } from './tools/register-mcp-server-tools';

export interface StartMcpServerOptions {
	baseUrl?: URL | string;
	port?: number;
	definition?: McpServerDefinition;
	extensions?: McpServerExtension[];
	toolRegistrars?: McpServerToolRegistrar[];
}

export async function startMcpServer({
	baseUrl,
	port = 0,
	definition,
	extensions = [],
	toolRegistrars = [],
}: StartMcpServerOptions = {}) {
	const resolvedBaseUrl = baseUrl?.toString();
	const bridge = new PlaygroundBridge(
		resolvedBaseUrl ? [resolvedBaseUrl] : []
	);
	await bridge.startWebSocketServer(port);
	const resolvedPort = bridge.getPort();
	const server = createServer({
		definition,
		extensions: [
			...extensions,
			{
				registerTools: (server) =>
					registerMcpServerTools(
						server,
						bridge,
						resolvedPort,
						resolvedBaseUrl,
						toolRegistrars
					),
			},
		],
	});
	const transport = new StdioServerTransport();
	await server.connect(transport);
	return { bridge, port: resolvedPort, server };
}
