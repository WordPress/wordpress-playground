// The MCP SDK expects Zod v3 schemas. We install zod@4 which
// re-exports a v3-compatible API via the "zod/v3" subpath.
// Once @modelcontextprotocol implements support for JSON schemas, we can remove the zod dependency.
import { z } from 'zod/v3';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { PlaygroundBridge } from '../bridge-server';
import {
	toolDefinitions,
	getSiteToolDefinitions,
	playgroundUrl,
	presentStorage,
	stringifyError,
} from './tool-definitions';
import type { ToolParam } from './tool-definitions';
import { toolExecutors } from './tool-executors';
import type { ToolClient } from './tool-executors';
function errorResult(prefix: string, error: unknown) {
	return {
		content: [
			{
				type: 'text' as const,
				text: `${prefix}: ${stringifyError(error)}`,
			},
		],
		isError: true,
	};
}

const siteIdSchema = z
	.string()
	.describe(
		'Target site ID. Call playground_list_sites first to discover ' +
			'available site IDs.'
	);

/**
 * Convert shared ToolParam[] to a Zod schema object suitable
 * for McpServer.registerTool(). Always includes siteId as the
 * first parameter.
 */
function paramsToZodSchema(params: ToolParam[]): Record<string, z.ZodType> {
	const schema: Record<string, z.ZodType> = {
		siteId: siteIdSchema,
	};

	for (const param of params) {
		let zodType: z.ZodType;
		switch (param.type) {
			case 'string':
				zodType = z.string();
				break;
			case 'boolean':
				zodType = z.boolean();
				break;
			case 'object':
				zodType = z.record(z.string(), z.string());
				break;
			default:
				throw new Error(
					`Unknown param type "${param.type}" for "${param.name}"`
				);
		}

		if (!param.required) {
			zodType = zodType.optional();
			if (param.default !== undefined) {
				zodType = (zodType as z.ZodOptional<z.ZodType>).default(
					param.default
				);
			}
		}

		zodType = zodType.describe(param.description);
		schema[param.name] = zodType;
	}

	return schema;
}

export function registerMcpServerTools(
	server: McpServer,
	bridge: PlaygroundBridge,
	port: number
) {
	const sendCommand = bridge.sendCommand.bind(bridge);
	const siteToolDefinitions = getSiteToolDefinitions(port);
	const url = playgroundUrl(port);

	// -- Site management tools --
	// These operate on the bridge itself, not on a PlaygroundClient.
	// Definitions are shared with WebMCP via getSiteToolDefinitions.

	const listSites = siteToolDefinitions['playground_list_sites'];
	server.registerTool(
		'playground_list_sites',
		{
			title: listSites.title,
			description: listSites.description,
			inputSchema: z.object({}),
			annotations: listSites.annotations,
		},
		async () => {
			const tabCount = bridge.getTabCount();
			const sites = bridge.listSites();
			if (sites.length === 0) {
				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify({
								connectedTabs: tabCount,
								sites: [],
								message: bridge.isConnected()
									? 'No sites are loaded.'
									: `No browser connected. Open the Playground website at ${url} to connect.`,
							}),
						},
					],
				};
			}
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify({
							connectedTabs: tabCount,
							sites: sites.map((s) => ({
								siteId: s.siteId,
								name: s.name,
								storage: s.storage,
								isActive: s.isActive,
								url: url,
							})),
						}),
					},
				],
			};
		}
	);

	const openSite = siteToolDefinitions['playground_open_site'];
	server.registerTool(
		'playground_open_site',
		{
			title: openSite.title,
			description: openSite.description,
			inputSchema: {
				siteId: siteIdSchema,
			},
			annotations: openSite.annotations,
		},
		async ({ siteId }) => {
			try {
				await bridge.sendCommand(siteId, '__open_site');
				const site = await bridge.waitForSiteActive(siteId, 30000);
				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify({
								siteId,
								name: site.siteName,
								isActive: true,
							}),
						},
					],
				};
			} catch (error) {
				return errorResult(openSite.errorPrefix, error);
			}
		}
	);

	const renameSite = siteToolDefinitions['playground_rename_site'];
	server.registerTool(
		'playground_rename_site',
		{
			title: renameSite.title,
			description: renameSite.description,
			inputSchema: paramsToZodSchema(renameSite.params),
			annotations: renameSite.annotations,
		},
		async ({ siteId, newName }) => {
			try {
				await bridge.sendCommand(siteId, '__rename_site', [newName]);
				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify({
								success: true,
								siteId,
								newName,
							}),
						},
					],
				};
			} catch (error) {
				return errorResult(renameSite.errorPrefix, error);
			}
		}
	);

	const saveSite = siteToolDefinitions['playground_save_site'];
	server.registerTool(
		'playground_save_site',
		{
			title: saveSite.title,
			description: saveSite.description,
			inputSchema: {
				siteId: siteIdSchema,
			},
			annotations: saveSite.annotations,
		},
		async ({ siteId }) => {
			try {
				const sites = bridge.listSites();
				const site = sites.find((s) => s.siteId === siteId);
				if (!site) {
					return errorResult(
						'Error saving site',
						new Error(`Unknown site: ${siteId}`)
					);
				}
				if (site.storage !== 'temporary') {
					return {
						content: [
							{
								type: 'text' as const,
								text: JSON.stringify({
									success: true,
									alreadySaved: true,
									siteId,
									name: site.name,
									storage: site.storage,
								}),
							},
						],
					};
				}
				const result = (await bridge.sendCommand(
					siteId,
					'__save_site'
				)) as { slug: string; storage: string };
				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify({
								success: true,
								alreadySaved: false,
								siteId,
								name: site.name,
								storage: presentStorage(result.storage),
							}),
						},
					],
				};
			} catch (error) {
				return errorResult(saveSite.errorPrefix, error);
			}
		}
	);

	// -- Per-site tools (shared executors) --

	for (const [name, def] of Object.entries(toolDefinitions)) {
		const executor = toolExecutors[name];
		if (!executor) {
			continue;
		}
		server.registerTool(
			name,
			{
				title: def.title,
				description: def.description,
				inputSchema: paramsToZodSchema(def.params),
				annotations: def.annotations,
			},
			async (args: Record<string, unknown>) => {
				const { siteId, ...input } = args;
				try {
					const id = siteId as string;
					const client: ToolClient = {
						run: (...args) =>
							sendCommand(id, 'run', args) as ReturnType<
								ToolClient['run']
							>,
						request: (...args) =>
							sendCommand(id, 'request', args) as ReturnType<
								ToolClient['request']
							>,
						goTo: (...args) =>
							sendCommand(id, 'goTo', args) as ReturnType<
								ToolClient['goTo']
							>,
						getCurrentURL: () =>
							sendCommand(id, 'getCurrentURL', []) as ReturnType<
								ToolClient['getCurrentURL']
							>,
						readFileAsText: (...args) =>
							sendCommand(
								id,
								'readFileAsText',
								args
							) as ReturnType<ToolClient['readFileAsText']>,
						writeFile: (...args) =>
							sendCommand(id, 'writeFile', args) as ReturnType<
								ToolClient['writeFile']
							>,
						listFiles: (...args) =>
							sendCommand(id, 'listFiles', args) as ReturnType<
								ToolClient['listFiles']
							>,
						mkdirTree: (...args) =>
							sendCommand(id, 'mkdirTree', args) as ReturnType<
								ToolClient['mkdirTree']
							>,
						unlink: (...args) =>
							sendCommand(id, 'unlink', args) as ReturnType<
								ToolClient['unlink']
							>,
						rmdir: (...args) =>
							sendCommand(id, 'rmdir', args) as ReturnType<
								ToolClient['rmdir']
							>,
						fileExists: (...args) =>
							sendCommand(id, 'fileExists', args) as ReturnType<
								ToolClient['fileExists']
							>,
					};
					const result = await executor(client, input);
					return {
						content: [
							{
								type: 'text' as const,
								text: JSON.stringify(result),
							},
						],
					};
				} catch (error) {
					return errorResult(def.errorPrefix, error);
				}
			}
		);
	}
}
