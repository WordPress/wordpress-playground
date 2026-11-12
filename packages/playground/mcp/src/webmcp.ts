/**
 * WebMCP registration for WordPress Playground.
 *
 * Registers playground tools with `document.modelContext` (the
 * Chrome WebMCP API) so that browser-side AI agents can interact
 * with the running Playground site.
 */

import {
	toolDefinitions,
	getSiteToolDefinitions,
	getWebMCPSiteAccessToolDefinitions,
	formatStorageLabel,
	paramsToJsonSchema,
	siteAccessParams,
	stringifyError,
} from './tools/tool-definitions';
import { toolExecutors, createToolClient } from './tools/tool-executors';
import type { PlaygroundBridgeConfig } from './bridge-client';
import type {
	SiteAccess,
	SiteAccessDecision,
	SiteAccessOptions,
} from './webmcp-site-access';
import { createSiteAccess } from './webmcp-site-access';
import { createSiteToolGatewayTools } from './webmcp-site-tools';

const siteToolDefinitions = getSiteToolDefinitions();
const siteAccessToolDefinitions = getWebMCPSiteAccessToolDefinitions();

export interface WebMCPConfig extends PlaygroundBridgeConfig {
	/**
	 * Grants agent access to sites. Created from this config when omitted, so
	 * pass one to show its state in the UI.
	 */
	siteAccess?: SiteAccess;
	/**
	 * Asks the user to grant access. Without it, access is granted only when
	 * `list()` returns exactly one site.
	 */
	confirmSiteAccess?: SiteAccessOptions['confirm'];
	/** Makes another site current. Enables `playground_switch_site`. */
	switchSite?(siteId: string): Promise<void>;
}

// -- WebMCP type declarations --

export interface ModelContextTool {
	name: string;
	description: string;
	inputSchema?: Record<string, unknown>;
	execute: (
		input: Record<string, unknown>,
		client?: ModelContextClient
	) => Promise<unknown>;
	annotations?: {
		readOnlyHint?: boolean;
		destructiveHint?: boolean;
		consequentialHint?: boolean;
		untrustedContentHint?: boolean;
		debugging?: boolean;
	};
}

export interface ModelContextClient {
	signal?: AbortSignal;
	requestUserInteraction?(callback: () => Promise<unknown>): Promise<unknown>;
}

interface ModelContext {
	provideContext(options: { tools: ModelContextTool[] }): void;
	registerTool(
		tool: ModelContextTool,
		options?: { signal?: AbortSignal }
	): Promise<void> | void;
	readonly tools: ModelContextTool[];
}

declare global {
	interface Document {
		modelContext?: ModelContext;
	}
}

// -- Registration --

let registrationController: AbortController | null = null;

/** Creates the site access controller `registerWebMCPTools()` would create. */
export function createWebMCPSiteAccess(config: WebMCPConfig): SiteAccess {
	return createSiteAccess({
		listSites: () =>
			config.list().map(({ slug, name, isActive }) => ({
				slug,
				name,
				isActive,
			})),
		getActiveClient: () => {
			try {
				return config.getClient();
			} catch {
				// No site is selected.
				return undefined;
			}
		},
		confirm: config.confirmSiteAccess,
	});
}

function getActiveSite(config: PlaygroundBridgeConfig) {
	const sites = config.list();
	const active = sites.find((s) => s.isActive);
	if (!active) {
		throw new Error('No active Playground site');
	}
	return active;
}

/**
 * Registers Playground's built-in WebMCP tools, replacing any previous registration.
 * Does nothing when WebMCP is unavailable. If registration fails, removes the tools
 * registered by this attempt and rejects. An aborted registration returns after its
 * pending registration operations settle.
 */
export async function registerWebMCPTools(config: WebMCPConfig): Promise<void> {
	const modelContext = getModelContext();
	if (!modelContext) {
		return;
	}

	// Abort any previous registration before re-registering.
	unregisterWebMCPTools();
	registrationController = new AbortController();
	const controller = registrationController;
	const signal = controller.signal;

	const siteAccess = config.siteAccess ?? createWebMCPSiteAccess(config);

	// Per-site tools. Each needs a grant, which decides the site it acts on.
	const tools: ModelContextTool[] = Object.entries(toolDefinitions).map(
		([name, def]) => ({
			name,
			description: def.description,
			inputSchema: paramsToJsonSchema([
				...siteAccessParams,
				...def.params,
			]),
			annotations: def.annotations,
			execute: async (input, client) => {
				try {
					client?.signal?.throwIfAborted();
					const executor = toolExecutors[name];
					if (!executor) {
						return {
							error: `No executor for "${name}"`,
						};
					}
					const { siteId, grant, ...toolInput } = input;
					const playground = await siteAccess.authorize(
						String(siteId ?? ''),
						String(grant ?? '')
					);
					siteAccess.recordCall({
						siteId: String(siteId),
						tool: name,
						input: toolInput,
					});
					const adapter = createToolClient(playground);
					const result = await executor(
						adapter,
						toolInput,
						client?.signal
					);
					client?.signal?.throwIfAborted();
					return result;
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
	tools.push(...createSiteAccessTools(config, siteAccess));
	tools.push(...createSiteToolGatewayTools(siteAccess));

	const results = await Promise.allSettled(
		tools.map(async (tool) => {
			await modelContext.registerTool(tool, { signal });
		})
	);
	if (signal.aborted) {
		return;
	}
	const failedRegistrations: Array<{ name: string; reason: unknown }> = [];
	for (const [index, result] of results.entries()) {
		if (result.status === 'rejected') {
			failedRegistrations.push({
				name: tools[index].name,
				reason: result.reason,
			});
		}
	}
	if (failedRegistrations.length > 0) {
		controller.abort();
		if (registrationController === controller) {
			registrationController = null;
		}
		throw new Error(
			'Failed to register WebMCP tools: ' +
				failedRegistrations
					.map(
						({ name, reason }) =>
							`${name} (${stringifyError(reason)})`
					)
					.join(', ')
		);
	}
}

/**
 * Unregisters Playground's built-in WebMCP tools and signals any pending registration
 * to stop. Tools registered separately by the application or site are unaffected.
 */
export function unregisterWebMCPTools(): void {
	registrationController?.abort();
	registrationController = null;
}

export function getModelContext(): ModelContext | undefined {
	if (typeof document === 'undefined') {
		return undefined;
	}
	const modelContext = document.modelContext;
	return typeof modelContext?.registerTool === 'function'
		? modelContext
		: undefined;
}

function createSiteAccessTools(
	config: WebMCPConfig,
	siteAccess: SiteAccess
): ModelContextTool[] {
	const requestDef =
		siteAccessToolDefinitions['playground_request_site_access'];
	const switchDef = siteAccessToolDefinitions['playground_switch_site'];
	const tools: ModelContextTool[] = [
		{
			name: 'playground_request_site_access',
			description: requestDef.description,
			inputSchema: paramsToJsonSchema(requestDef.params),
			annotations: requestDef.annotations,
			execute: async (input, client) => {
				try {
					client?.signal?.throwIfAborted();
					const reason =
						typeof input['reason'] === 'string' &&
						input['reason'].trim()
							? input['reason'].trim()
							: undefined;
					// Hand control to the user while they decide, so the agent
					// does not act on the dialog itself where browsers support it.
					const requestUserInteraction =
						client?.requestUserInteraction?.bind(client);
					return await siteAccess.request(String(input['siteId']), {
						reason,
						interact: requestUserInteraction
							? async (confirm) =>
									(await requestUserInteraction(
										confirm
									)) as SiteAccessDecision
							: undefined,
					});
				} catch (error) {
					return {
						error: `${requestDef.errorPrefix}: ${stringifyError(error)}`,
					};
				}
			},
		},
	];
	const switchSite = config.switchSite?.bind(config);
	if (switchSite) {
		tools.push({
			name: 'playground_switch_site',
			description: switchDef.description,
			inputSchema: paramsToJsonSchema(switchDef.params),
			annotations: switchDef.annotations,
			execute: async (input, client) => {
				try {
					client?.signal?.throwIfAborted();
					const siteId = String(input['siteId'] ?? '');
					await siteAccess.authorizeSwitch(
						siteId,
						String(input['grant'] ?? '')
					);
					await switchSite(siteId);
					return { success: true, siteId };
				} catch (error) {
					return {
						error: `${switchDef.errorPrefix}: ${stringifyError(error)}`,
					};
				}
			},
		});
	}
	return tools;
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
			inputSchema: paramsToJsonSchema(listDef.params),
			annotations: listDef.annotations,
			execute: async (_input, client) => {
				try {
					client?.signal?.throwIfAborted();
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
			inputSchema: paramsToJsonSchema(saveDef.params),
			annotations: saveDef.annotations,
			execute: async (_input, client) => {
				try {
					client?.signal?.throwIfAborted();
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
					// Storage operations do not currently expose an interrupt API.
					const saved = await config.saveInBrowser();
					client?.signal?.throwIfAborted();
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
			execute: async (input, client) => {
				try {
					client?.signal?.throwIfAborted();
					const newName = input['newName'] as string;
					const sites = config.list();
					const activeSite = sites.find((s) => s.isActive);
					await config.rename(newName);
					client?.signal?.throwIfAborted();
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
			inputSchema: paramsToJsonSchema(websiteUrlDef.params),
			annotations: websiteUrlDef.annotations,
			execute: async (_input, client) => {
				try {
					client?.signal?.throwIfAborted();
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
