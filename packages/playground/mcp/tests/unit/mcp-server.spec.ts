import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../../src/mcp-server';
import type { McpServerDefinition } from '../../src/mcp-server';

describe('MCP server prompts', () => {
	it('does not ship MyWP prompts for generic Playground', async () => {
		await expect(
			withPromptClient(undefined, async (client) => client.listPrompts())
		).rejects.toThrow('Method not found');
	});

	it('ships prompts from the provided server definition', async () => {
		await withPromptClient(
			{
				name: 'test-server',
				description: 'Test server',
				prompts: [
					{
						name: 'test-prompt',
						title: 'Test Prompt',
						description: 'A prompt from the server definition.',
						text: 'Use the test prompt.',
					},
				],
			},
			async (client) => {
				const prompts = await client.listPrompts();
				expect(prompts.prompts.map((prompt) => prompt.name)).toEqual([
					'test-prompt',
				]);

				const prompt = await client.getPrompt({
					name: 'test-prompt',
					arguments: {},
				});

				expect(prompt.messages[0].content.text).toContain(
					'Use the test prompt.'
				);
			}
		);
	});

	it('ships prompts from extensions', async () => {
		await withPromptClient(
			undefined,
			async (client) => {
				const prompts = await client.listPrompts();
				expect(prompts.prompts.map((prompt) => prompt.name)).toEqual([
					'extension-prompt',
				]);

				const prompt = await client.getPrompt({
					name: 'extension-prompt',
					arguments: {},
				});

				expect(prompt.messages[0].content.text).toContain(
					'Use the extension prompt.'
				);
			},
			true
		);
	});
});

async function withPromptClient<T>(
	serverDefinition: McpServerDefinition | undefined,
	callback: (client: Client) => Promise<T>,
	includeExtensionPrompt = false
): Promise<T> {
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	const server = createServer({
		definition: serverDefinition,
		extensions: includeExtensionPrompt
			? [
					{
						prompts: [
							{
								name: 'extension-prompt',
								title: 'Extension Prompt',
								description: 'A prompt from an MCP extension.',
								text: 'Use the extension prompt.',
							},
						],
					},
				]
			: [],
	});
	const client = new Client({
		name: 'mcp-server-unit-test',
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
