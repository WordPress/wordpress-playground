import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { PlaygroundBridge } from './bridge-server';
import { registerSiteManagementTools } from './tools/site-management';
import { registerCodeExecutionTools } from './tools/code-execution';
import { registerFilesystemTools } from './tools/filesystem';

export { decodeResponseBytes } from './tools/utils';

export function createServer(): McpServer {
	return new McpServer({
		name: 'wordpress-playground',
		version: '0.1.0',
	});
}

export function registerTools(
	server: McpServer,
	bridge: PlaygroundBridge
): void {
	registerSiteManagementTools(server, bridge);
	registerCodeExecutionTools(server, bridge);
	registerFilesystemTools(server, bridge);
}
