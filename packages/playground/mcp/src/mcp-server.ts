import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
export function createServer(): McpServer {
	return new McpServer({
		name: 'wordpress-playground',
		version: '0.1.0',
	});
}
