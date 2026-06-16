import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { PlaygroundBridge } from './bridge-server';
import { createServer } from './mcp-server';
import { registerMcpServerTools } from './tools/register-mcp-server-tools';

function getPortFromArgs(): number {
	const portArg = process.argv.find((a) => a.startsWith('--port='));
	if (portArg) {
		return Number(portArg.split('=')[1]);
	}
	return 0;
}

function getBaseUrlFromArgs(): string | undefined {
	const urlArg = process.argv.find((a) => a.startsWith('--url='));
	return urlArg?.split('=').slice(1).join('=');
}

async function main() {
	const baseUrl = getBaseUrlFromArgs();
	const bridge = new PlaygroundBridge(baseUrl ? [baseUrl] : []);
	await bridge.startWebSocketServer(getPortFromArgs());
	const port = bridge.getPort();
	const server = createServer();
	registerMcpServerTools(server, bridge, port, baseUrl);
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error('[MCP] WordPress Playground MCP server running on stdio');
}

main().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
