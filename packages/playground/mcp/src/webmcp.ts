/**
 * WebMCP registration for WordPress Playground.
 *
 * Registers playground tools with `navigator.modelContext` (the
 * Chrome WebMCP API) so that browser-side AI agents can interact
 * with the running Playground site.
 */

import type { PlaygroundClient } from '@wp-playground/remote';
import {
	toolDefinitions,
	getSiteToolDefinitions,
	formatStorageLabel,
	paramsToJsonSchema,
	stringifyError,
} from './tools/tool-definitions';
import { toolExecutors, createToolClient } from './tools/tool-executors';
import type { PlaygroundBridgeConfig } from './bridge-client';

const siteToolDefinitions = getSiteToolDefinitions();

// -- WebMCP type declarations --

interface ModelContextTool {
	name: string;
	description: string;
	inputSchema?: Record<string, unknown>;
	execute: (
		input: Record<string, unknown>,
		client: ModelContextClient
	) => Promise<unknown>;
	annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
}

interface ModelContextClient {
	requestUserInteraction(callback: () => Promise<unknown>): Promise<unknown>;
}

interface ModelContext {
	provideContext(options: { tools: ModelContextTool[] }): void;
	registerTool(
		tool: ModelContextTool,
		options?: { signal?: AbortSignal }
	): void;
	readonly tools: ModelContextTool[];
}

declare global {
	interface Navigator {
		modelContext?: ModelContext;
	}
}

// -- Registration --

let registrationController: AbortController | null = null;

function getActiveSite(config: PlaygroundBridgeConfig) {
	const sites = config.list();
	const active = sites.find((s) => s.isActive);
	if (!active) {
		throw new Error('No active Playground site');
	}
	return active;
}

export function registerWebMCPTools(config: PlaygroundBridgeConfig): void {
	if (typeof navigator === 'undefined' || !navigator.modelContext) {
		return;
	}

	// Abort any previous registration before re-registering.
	registrationController?.abort();
	registrationController = new AbortController();
	const signal = registrationController.signal;

	function getActiveClient(): PlaygroundClient {
		const client = config.getClient();
		if (!client) {
			throw new Error('No client for active site');
		}
		return client;
	}

	// Per-site tools
	const tools: ModelContextTool[] = Object.entries(toolDefinitions).map(
		([name, def]) => ({
			name,
			description: def.description,
			inputSchema: paramsToJsonSchema(def.params),
			annotations: def.annotations,
			execute: async (input) => {
				try {
					const executor = toolExecutors[name];
					if (!executor) {
						return {
							error: `No executor for "${name}"`,
						};
					}
					const adapter = createToolClient(getActiveClient());
					return await executor(adapter, input);
				} catch (error) {
					return {
						error: `${def.errorPrefix}: ${stringifyError(error)}`,
					};
				}
			},
		})
	);

	// Site management tools
	tools.push(...createSiteManagementTools(config));

	for (const tool of tools) {
		navigator.modelContext.registerTool(tool, { signal });
	}
}

function createSiteManagementTools(
	config: PlaygroundBridgeConfig
): ModelContextTool[] {
	const listDef = siteToolDefinitions['playground_list_sites'];
	const saveDef = siteToolDefinitions['playground_save_in_browser'];
	const renameDef = siteToolDefinitions['playground_rename_site'];
	const websiteUrlDef = siteToolDefinitions['playground_get_website_url'];

	return [
		{
			name: 'playground_list_sites',
			description: listDef.description,
			annotations: listDef.annotations,
			execute: async () => {
				try {
					return {
						connectedTabs: 1,
						sites: config.list().map((s) => ({
							siteId: s.slug,
							name: s.name,
							storage: formatStorageLabel(s.storage),
							isActive: s.isActive,
						})),
					};
				} catch (error) {
					return {
						error: `${listDef.errorPrefix}: ${stringifyError(error)}`,
					};
				}
			},
		},
		{
			name: 'playground_save_in_browser',
			description: saveDef.description,
			annotations: saveDef.annotations,
			execute: async () => {
				try {
					const site = getActiveSite(config);
					const storage = formatStorageLabel(site.storage);
					if (storage !== 'temporary') {
						return {
							success: true,
							alreadySaved: true,
							siteId: site.slug,
							name: site.name,
							storage,
						};
					}
					const saved = await config.saveInBrowser();
					return {
						success: true,
						alreadySaved: false,
						siteId: saved.slug,
						name: site.name ?? saved.slug,
						storage: formatStorageLabel(saved.storage),
					};
				} catch (error) {
					return {
						error: `${saveDef.errorPrefix}: ${stringifyError(error)}`,
					};
				}
			},
		},
		{
			name: 'playground_rename_site',
			description: renameDef.description,
			inputSchema: paramsToJsonSchema(renameDef.params),
			annotations: renameDef.annotations,
			execute: async (input) => {
				try {
					const newName = input['newName'] as string;
					const sites = config.list();
					const activeSite = sites.find((s) => s.isActive);
					await config.rename(newName);
					return {
						success: true,
						siteId: activeSite?.slug,
						newName,
					};
				} catch (error) {
					return {
						error: `${renameDef.errorPrefix}: ${stringifyError(error)}`,
					};
				}
			},
		},
		{
			name: 'playground_get_website_url',
			description: websiteUrlDef.description,
			annotations: websiteUrlDef.annotations,
			execute: async () => {
				try {
					return {
						url: window.location.href,
					};
				} catch (error) {
					return {
						error: `${websiteUrlDef.errorPrefix}: ${stringifyError(error)}`,
					};
				}
			},
		},
	];
}
