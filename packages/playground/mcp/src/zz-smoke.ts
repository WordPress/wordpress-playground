import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ToolListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import { WebSocket } from 'ws';
import { PlaygroundBridge } from '/Users/fellyph/Sites/wordpress-playground/packages/playground/mcp/src/bridge-server';
import { registerMcpServerTools } from '/Users/fellyph/Sites/wordpress-playground/packages/playground/mcp/src/tools/register-mcp-server-tools';

const bridge = new PlaygroundBridge();
await bridge.startWebSocketServer(0);
const port = bridge.getPort();
const server = new McpServer({ name: 't', version: '1' });
registerMcpServerTools(server, bridge, port);
const [a, b] = InMemoryTransport.createLinkedPair();
const client = new Client({ name: 'c', version: '1' });
let changes = 0;
client.setNotificationHandler(ToolListChangedNotificationSchema, () => {
	changes++;
});
await Promise.all([server.connect(a), client.connect(b)]);
const token = (
	await (
		await fetch('http://127.0.0.1:' + port + '/bridge-token', {
			headers: { origin: 'http://localhost:5400' },
		})
	).json()
).token;
const ws = new WebSocket('ws://127.0.0.1:' + port + '?token=' + token, {
	origin: 'http://localhost:5400',
});
await new Promise((r) => ws.on('open', r));
const ability = {
	name: 'test/echo',
	label: 'Echo',
	description: 'Echo input',
	input_schema: {
		type: 'object',
		id: 'x',
		properties: { a: { type: 'string' } },
	},
	meta: { annotations: { readonly: true, destructive: false } },
};
ws.on('message', (d) => {
	const m = JSON.parse(d.toString());
	if (m.type === 'command')
		ws.send(
			JSON.stringify({
				id: m.id,
				type: 'response',
				value: m.args[1]?.fail
					? {
							success: false,
							errors: [{ code: 'x', message: 'nope' }],
						}
					: { success: true, data: m.args },
			})
		);
});
const reg = (abilities?: unknown[]) =>
	ws.send(
		JSON.stringify({
			type: 'register',
			tabId: 't1',
			sites: [
				{
					slug: 's1',
					name: 'S',
					storage: 'temporary',
					isActive: true,
					abilities,
				},
			],
		})
	);
reg([ability]);
await new Promise((r) => setTimeout(r, 200));
let tools = (await client.listTools()).tools.filter((t) =>
	t.name.startsWith('wp_')
);
console.log(JSON.stringify(tools, null, 1));
console.log(
	JSON.stringify(
		await client.callTool({
			name: 'wp_ability_test.echo',
			arguments: { siteId: 's1', input: { a: 'hi' } },
		})
	)
);
console.log(
	JSON.stringify(
		await client.callTool({
			name: 'wp_ability_test.echo',
			arguments: { siteId: 's1', input: { fail: true } },
		})
	)
);
console.log(
	JSON.stringify(
		await client.callTool({
			name: 'wp_ability_test.echo',
			arguments: { siteId: 'nope' },
		})
	)
);
reg([{ ...ability, description: 'changed' }]);
await new Promise((r) => setTimeout(r, 200));
console.log(
	'desc',
	(await client.listTools()).tools.find(
		(t) => t.name === 'wp_ability_test.echo'
	)?.description
);
reg(undefined);
await new Promise((r) => setTimeout(r, 200));
tools = (await client.listTools()).tools.filter((t) =>
	t.name.startsWith('wp_')
);
console.log('after remove', tools.length, 'changes', changes);
reg([ability]);
await new Promise((r) => setTimeout(r, 200));
ws.close();
await new Promise((r) => setTimeout(r, 200));
console.log(
	'after close',
	(await client.listTools()).tools.filter((t) => t.name.startsWith('wp_'))
		.length
);
await bridge.close();
process.exit(0);
