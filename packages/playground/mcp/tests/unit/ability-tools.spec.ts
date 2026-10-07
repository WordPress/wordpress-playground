import { afterEach, describe, expect, it, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ToolListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import type { AbilityResult } from '@wp-playground/remote';
import { PlaygroundBridge } from '../../src/bridge-server';
import { startMcpBridge } from '../../src/bridge-client';
import type { McpBridgeHandle } from '../../src/bridge-client';
import { registerAbilityTools } from '../../src/tools/ability-tools';
import type { ExposedAbility } from '../../src/exposed-abilities';

/*
 * Contract: an MCP client can only see and run abilities the user
 * currently exposes in the Abilities panel of the tab that owns the
 * site. These tests wire the real MCP server, the real WebSocket bridge
 * server and the real browser-side bridge client together; only the
 * website's ability controller is faked.
 */

const echo: ExposedAbility = {
	name: 'test/echo',
	label: 'Echo',
	description: 'Echoes its input',
	input_schema: { type: 'object', properties: { text: { type: 'string' } } },
	meta: {
		annotations: { readonly: true, destructive: false, idempotent: true },
	},
};

interface FakeTab {
	exposed: ExposedAbility[];
	activeSlug: string;
	executeAbility: ReturnType<
		typeof vi.fn<(name: string, input?: unknown) => Promise<AbilityResult>>
	>;
	handle: McpBridgeHandle;
}

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
	while (cleanups.length) {
		await cleanups.pop()!();
	}
	vi.unstubAllGlobals();
});

async function setup() {
	// Node's fetch omits the Origin header browsers send, which the
	// bridge token endpoint requires.
	const realFetch = globalThis.fetch;
	vi.stubGlobal('fetch', (url: string, init: RequestInit = {}) =>
		realFetch(url, {
			...init,
			headers: { ...init.headers, Origin: 'http://localhost:5400' },
		})
	);

	const bridge = new PlaygroundBridge();
	await bridge.startWebSocketServer(0);
	cleanups.push(() => bridge.close());

	const server = new McpServer(
		{ name: 'test', version: '1.0.0' },
		{ capabilities: { tools: { listChanged: true } } }
	);
	// Production registers the static tools first; the SDK only allows
	// declaring the tools capability before connecting.
	server.registerTool('noop', { description: 'noop' }, async () => ({
		content: [],
	}));
	const stop = registerAbilityTools(server, bridge);
	cleanups.push(stop);

	const client = new Client({ name: 'test-client', version: '1.0.0' });
	const listChanged = vi.fn();
	client.setNotificationHandler(ToolListChangedNotificationSchema, () =>
		listChanged()
	);
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	await Promise.all([
		server.connect(serverTransport),
		client.connect(clientTransport),
	]);
	cleanups.push(() => client.close());

	function openTab(activeSlug: string, exposed: ExposedAbility[] = []) {
		const tab = {
			exposed,
			activeSlug,
			executeAbility: vi.fn(
				async (
					_name: string,
					input?: unknown
				): Promise<AbilityResult> => ({
					success: true,
					data: { received: input },
				})
			),
		} as FakeTab;
		tab.handle = startMcpBridge(
			{
				list: () =>
					['site-a', 'site-b'].map((slug) => ({
						slug,
						name: slug,
						storage: 'temporary',
						isActive: slug === tab.activeSlug,
					})),
				getClient: () => undefined,
				rename: async () => {},
				saveInBrowser: async () => ({ slug: '', storage: '' }),
				listExposedAbilities: () => tab.exposed,
				executeAbility: (name, input) =>
					tab.executeAbility(name, input),
			},
			bridge.getPort()
		);
		cleanups.push(() => tab.handle.stop());
		return tab;
	}

	async function toolNames() {
		const { tools } = await client.listTools();
		return tools.map((tool) => tool.name).filter((n) => n !== 'noop');
	}

	async function waitForTools(expected: string[]) {
		await vi.waitFor(async () =>
			expect(await toolNames()).toEqual(expected)
		);
	}

	function call(siteId: string, input: unknown = { text: 'hi' }) {
		return client.callTool({
			name: 'wp_ability_test.echo',
			arguments: { siteId, input },
		});
	}

	return { bridge, client, listChanged, openTab, waitForTools, call };
}

describe('wp_ability_* MCP tools', () => {
	it('appear when the user exposes an ability and disappear when revoked', async () => {
		const { openTab, waitForTools, listChanged, client } = await setup();
		const tab = openTab('site-a');
		await waitForTools([]);

		tab.exposed = [echo];
		tab.handle.notifySitesChanged();
		await waitForTools(['wp_ability_test.echo']);
		expect(listChanged).toHaveBeenCalled();

		const [tool] = (await client.listTools()).tools.filter(
			(t) => t.name === 'wp_ability_test.echo'
		);
		expect(tool.annotations).toMatchObject({
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
		});
		expect(tool.inputSchema.properties?.['input']).toMatchObject(
			echo.input_schema!
		);

		listChanged.mockClear();
		tab.exposed = [];
		tab.handle.notifySitesChanged();
		await waitForTools([]);
		expect(listChanged).toHaveBeenCalled();
	});

	it('removes ability tools when the exposing tab disconnects', async () => {
		const { openTab, waitForTools } = await setup();
		const tab = openTab('site-a', [echo]);
		await waitForTools(['wp_ability_test.echo']);
		tab.handle.stop();
		await waitForTools([]);
	});

	it('passes input through unchanged and surfaces WordPress failures as isError', async () => {
		const { openTab, waitForTools, call } = await setup();
		const tab = openTab('site-a', [echo]);
		await waitForTools(['wp_ability_test.echo']);

		const input = { text: 'hi', nested: [1, { deep: null }] };
		const ok = await call('site-a', input);
		expect(tab.executeAbility).toHaveBeenCalledWith('test/echo', input);
		expect(ok.isError).toBeFalsy();
		expect(JSON.parse((ok.content as any)[0].text)).toEqual({
			received: input,
		});

		tab.executeAbility.mockResolvedValueOnce({
			success: false,
			errors: [
				{
					code: 'ability_invalid_permissions',
					message:
						'Ability "test/echo" does not have necessary permission.',
				},
			],
		});
		const failed = await call('site-a');
		expect(failed.isError).toBe(true);
		expect((failed.content as any)[0].text).toContain(
			'ability_invalid_permissions'
		);
	});

	it('rejects calls for a site that does not expose the ability without contacting the browser', async () => {
		const { openTab, waitForTools, call } = await setup();
		const exposing = openTab('site-a', [echo]);
		const other = openTab('site-b');
		await waitForTools(['wp_ability_test.echo']);

		const result = await call('site-b');
		expect(result.isError).toBe(true);
		expect(other.executeAbility).not.toHaveBeenCalled();
		expect(exposing.executeAbility).not.toHaveBeenCalled();
	});

	it('the tab refuses abilities revoked before the server learned about it', async () => {
		const { openTab, waitForTools, call } = await setup();
		const tab = openTab('site-a', [echo]);
		await waitForTools(['wp_ability_test.echo']);

		// The user switched the ability off, but the registration update
		// has not reached the server yet.
		tab.exposed = [];
		const result = await call('site-a');
		expect(result.isError).toBe(true);
		expect((result.content as any)[0].text).toContain('not exposed');
		expect(tab.executeAbility).not.toHaveBeenCalled();
	});

	it('the tab refuses abilities for a site it no longer shows', async () => {
		const { openTab, waitForTools, call, bridge } = await setup();
		const tab = openTab('site-a', [echo]);
		await waitForTools(['wp_ability_test.echo']);

		// The tab switched sites; the server still routes site-a to it.
		tab.activeSlug = 'site-b';
		expect(bridge.listExposedAbilities().has('site-a')).toBe(true);
		const result = await call('site-a');
		expect(result.isError).toBe(true);
		expect((result.content as any)[0].text).toContain('not active');
		expect(tab.executeAbility).not.toHaveBeenCalled();
	});
});
