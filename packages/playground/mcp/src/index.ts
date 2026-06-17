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

function getBaseUrlFromArgs(): URL | undefined {
	const urlArg = process.argv.find((a) => a.startsWith('--url='));
	if (!urlArg) {
		return undefined;
	}
	const value = urlArg.split('=').slice(1).join('=');
	try {
		return new URL(value);
	} catch {
		throw new Error(`Invalid --url: "${value}" must be an absolute URL.`);
	}
}

async function main() {
	const baseUrl = getBaseUrlFromArgs();
	const bridge = new PlaygroundBridge(baseUrl ? [baseUrl.href] : []);
	await bridge.startWebSocketServer(getPortFromArgs());
	const port = bridge.getPort();
	const server = createServer();
	registerMcpServerTools(server, bridge, port, baseUrl?.href);
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error('[MCP] WordPress Playground MCP server running on stdio');
}

main().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
