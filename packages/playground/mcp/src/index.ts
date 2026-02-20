import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { PlaygroundBridge, DEFAULT_WS_PORT } from './bridge-server';
import { createServer, registerTools } from './mcp-server';

function getPort(): number {
	const portArg = process.argv.find((a) => a.startsWith('--port='));
	if (portArg) {
		return Number(portArg.split('=')[1]);
	}
	if (process.env['MCP_WS_PORT']) {
		return Number(process.env['MCP_WS_PORT']);
	}
	return DEFAULT_WS_PORT;
}

async function main() {
	const bridge = new PlaygroundBridge();
	await bridge.startWebSocketServer(getPort());
	const server = createServer();
	registerTools(server, bridge);
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error('[MCP] WordPress Playground MCP server running on stdio');
}

main().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
