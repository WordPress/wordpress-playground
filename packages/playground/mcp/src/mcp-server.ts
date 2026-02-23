import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
export function createServer(): McpServer {
	return new McpServer({
		name: 'wordpress-playground',
		version: '0.1.0',
		description:
			'Use this server when you need a live WordPress environment without any local setup. ' +
			"WordPress Playground runs entirely in the user's browser tab via WebAssembly — no PHP, MySQL, " +
			'or server required. You are automatically authenticated as an admin user.\n\n' +
			'Typical workflow: playground_list_sites → playground_save_site → filesystem/PHP operations ' +
			'→ playground_navigate to verify results.\n\n' +
			'Capabilities: execute arbitrary PHP with full WordPress access, read/write files in the virtual filesystem ' +
			'(WordPress root: /wordpress/), make HTTP requests to the site, navigate the browser, ' +
			'and manage multiple Playground sites simultaneously.\n\n' +
			'Important: sites are temporary by default and not persisted between sessions. ' +
			'Call playground_save_site early in any multi-step workflow where losing progress would be costly.\n\n' +
			'Error handling: tool failures are returned as thrown exceptions with descriptive messages, ' +
			'not as silent failures.',
	});
}
