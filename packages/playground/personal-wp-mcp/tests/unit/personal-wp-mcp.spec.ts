import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, registerMcpServerTools } from '@wp-playground/mcp/api';
import { personalWpMcpProfile, registerPersonalWpMcpTools } from '../../src';

describe('MyWP MCP prompts', () => {
	it('ships MyWP agent prompt and focused skill prompts', async () => {
		await withPromptClient(async (client) => {
			const prompts = await client.listPrompts();
			const names = prompts.prompts.map((prompt) => prompt.name).sort();

			expect(names).toEqual([
				'mywp-agent',
				'mywp-skill-abilities',
				'mywp-skill-create-app',
				'mywp-skill-file-editing',
				'mywp-skill-plugin-development',
				'mywp-skill-sync-local-changes',
			]);

			const agentPrompt = await client.getPrompt({
				name: 'mywp-agent',
				arguments: {},
			});
			const agentText = agentPrompt.messages[0].content.text;

			expect(agentText).toContain('Call playground_list_sites');
			expect(agentText).toContain('WordPress Abilities API');
			expect(agentText).toContain('playground_save_in_browser');

			const syncPrompt = await client.getPrompt({
				name: 'mywp-skill-sync-local-changes',
				arguments: {},
			});
			const syncText = syncPrompt.messages[0].content.text;

			expect(syncText).toContain('Confirm which connected siteId');
			expect(syncText).toContain(
				'Local project files are not automatically mounted'
			);
			expect(syncText).toContain(
				'/wordpress/wp-content/plugins/{plugin-slug}/'
			);

			const createAppPrompt = await client.getPrompt({
				name: 'mywp-skill-create-app',
				arguments: {},
			});
			const createAppText = createAppPrompt.messages[0].content.text;

			expect(createAppText).toContain(
				'composer create-project akirk/create-wp-app {plugin-slug}'
			);
			expect(createAppText).toContain('WP_APP_DEPENDENCY_MODE=composer');
			expect(createAppText).toContain('git init');
			expect(createAppText).toContain(
				'git commit -m "Initial create-wp-app scaffold"'
			);
			expect(createAppText).toContain(
				'Commit meaningful local changes after implementation'
			);
			expect(createAppText).toContain('wp_app_enqueue_script()');
			expect(createAppText).toContain('mywp-skill-sync-local-changes');
		});
	});
});

describe('MyWP MCP tools', () => {
	it('registers plugin guidance using the Playground MCP API', async () => {
		await withToolClient(async (client) => {
			const tools = await client.listTools();
			expect(tools.tools.map((tool) => tool.name)).toContain(
				'mywp_get_plugin_guidance'
			);

			const result = await client.callTool({
				name: 'mywp_get_plugin_guidance',
				arguments: {
					siteId: 'stub-site',
				},
			});
			const parsed = JSON.parse(
				(result.content as Array<{ text: string }>)[0].text
			);

			expect(parsed.summary).toContain('WordPress Abilities API');
			expect(parsed.filters).toEqual([
				'ai_assistant_ability_domains',
				'ai_assistant_welcome_tips',
			]);
			expect(parsed.shape.entries).toContain(
				'Structured category/domain mappings'
			);
			expect(parsed.shape.systemPrompt).toContain(
				'Running text suitable for appending'
			);
			expect(parsed.entries).toContainEqual(
				expect.objectContaining({
					namespace: 'cookbook',
					source: 'ai_assistant_ability_domains',
					useWhen: [
						'saved recipe collection',
						'URL/text recipe import',
						'ingredient-based recipe search',
						'weekly meal planner',
						'shopping-list builder',
						'serving scaling and variations',
					],
				})
			);
			expect(parsed.entries).toContainEqual(
				expect.objectContaining({
					namespace: 'events',
					source: 'ai_assistant_ability_domains',
					useWhen: ['events', 'tickets'],
				})
			);
			expect(parsed.systemPrompt).toContain(
				'prefer the WordPress Abilities API via playground_request'
			);
			expect(parsed.systemPrompt).toContain(
				'- cookbook: saved recipe collection, URL/text recipe import, ingredient-based recipe search, weekly meal planner, shopping-list builder, serving scaling and variations.'
			);
			expect(parsed.systemPrompt).toContain(
				'These slugs are ability categories/domains, not executable ability IDs.'
			);
			expect(parsed.welcomeTips.cookbook).toEqual([
				'Ask me to find a recipe.',
			]);
		});
	});
});

async function withPromptClient<T>(
	callback: (client: Client) => Promise<T>
): Promise<T> {
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	const server = createServer({ definition: personalWpMcpProfile });
	const client = new Client({
		name: 'personal-wp-mcp-prompt-test',
		version: '1.0.0',
	});

	await server.connect(serverTransport);
	await client.connect(clientTransport);

	try {
		return await callback(client);
	} finally {
		await client.close();
		await server.close();
	}
}

async function withToolClient<T>(
	callback: (client: Client) => Promise<T>
): Promise<T> {
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	const bridge = createBridgeStub();
	const server = createServer({
		extensions: [
			{
				registerTools: (server) =>
					registerMcpServerTools(
						server,
						bridge,
						7999,
						'https://my.wordpress.net/',
						[registerPersonalWpMcpTools]
					),
			},
		],
	});
	const client = new Client({
		name: 'personal-wp-mcp-tool-test',
		version: '1.0.0',
	});

	await server.connect(serverTransport);
	await client.connect(clientTransport);

	try {
		return await callback(client);
	} finally {
		await client.close();
		await server.close();
	}
}

function createBridgeStub(): any {
	return {
		sendCommand: async (_siteId: string, command: string) => {
			if (command === 'run') {
				return {
					text: JSON.stringify({
						aiAssistantDomains: {
							cookbook:
								'saved recipe collection, URL/text recipe import, ingredient-based recipe search, weekly meal planner, shopping-list builder, serving scaling and variations',
							events: 'events, tickets',
						},
						aiAssistantWelcomeTips: {
							cookbook: ['Ask me to find a recipe.'],
						},
					}),
					errors: '',
					exitCode: 0,
				};
			}
			return undefined;
		},
		getTabCount: () => 0,
		listSites: () => [],
		isConnected: () => false,
		waitForSiteActive: async () => ({
			siteId: 'stub-site',
			siteName: 'Stub Site',
		}),
	};
}
