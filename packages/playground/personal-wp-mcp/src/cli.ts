import { startMcpServer } from '@wp-playground/mcp/api';
import { personalWpMcpProfile } from './profile';
import { registerPersonalWpMcpTools } from './tools';

function getPortFromArgs(): number {
	const portArg = process.argv.find((a) => a.startsWith('--port='));
	if (portArg) {
		return Number(portArg.split('=')[1]);
	}
	return 0;
}

function getBaseUrlFromArgs(): URL {
	const urlArg = process.argv.find((a) => a.startsWith('--url='));
	if (!urlArg) {
		return new URL('https://my.wordpress.net/');
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
	await startMcpServer({
		baseUrl,
		port: getPortFromArgs(),
		definition: personalWpMcpProfile,
		toolRegistrars: [registerPersonalWpMcpTools],
	});
	// eslint-disable-next-line no-console
	console.error('[MCP] MyWP MCP server running on stdio');
}

main().catch((error) => {
	// eslint-disable-next-line no-console
	console.error('Fatal error:', error);
	process.exit(1);
});
