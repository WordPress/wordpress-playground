/**
 * Re-advertises the WebMCP tools registered inside the WordPress document as
 * tools of the Playground page itself.
 *
 * A plugin running in Playground can register tools with
 * `document.modelContext`, but that registry lives in a nested,
 * service-worker-served iframe an agent never sees. This proxy mirrors those
 * tools onto the top-level `document.modelContext` and forwards each call back
 * into the WordPress document:
 *
 *     agent → document.modelContext (this page)
 *           → PlaygroundClient.callWebMCPTool()   (Comlink)
 *           → remote frame                        (postMessage)
 *           → WordPress document                  (the plugin's execute())
 */

import type {
	PlaygroundClient,
	WebMCPToolDescriptor,
} from '@wp-playground/remote';
import { logger } from '@php-wasm/logger';
import {
	toolDefinitions,
	getSiteToolDefinitions,
	stringifyError,
} from './tools/tool-definitions';
import type { ModelContextTool } from './webmcp';
import { getModelContext } from './webmcp';

export interface WebMCPSiteToolProxy {
	/**
	 * The tools the WordPress document currently offers, whether or not this
	 * browser can advertise them. Useful for confirming that a plugin's
	 * registration was picked up.
	 */
	getTools(): WebMCPToolDescriptor[];

	/**
	 * Whether the tools are advertised to an agent. False in a browser without
	 * WebMCP support, where the tools are still detected but have nowhere to go.
	 */
	isAdvertised(): boolean;

	/** Runs one of the site's tools. */
	callTool(name: string, args: Record<string, unknown>): Promise<unknown>;

	stop(): void;
}

/**
 * Names Playground registers itself. A site tool may not take one of them
 * over, or an agent asking to execute PHP would reach the site's plugin
 * instead.
 */
function reservedToolNames(): Set<string> {
	return new Set([
		...Object.keys(toolDefinitions),
		...Object.keys(getSiteToolDefinitions()),
	]);
}

/**
 * Starts mirroring `client`'s in-site WebMCP tools onto this page.
 *
 * Every announcement carries the full tool list, so the previous registration
 * is aborted and the new list registered in its place. Returns a handle that
 * unregisters everything it registered.
 *
 * The site is observed even in a browser without WebMCP support, where the
 * handle is the only way to see what the site offers. Observing costs one
 * subscription: the WordPress document announces its tools either way.
 */
export function startWebMCPSiteToolProxy(
	client: PlaygroundClient
): WebMCPSiteToolProxy {
	const modelContext = getModelContext();
	const reserved = reservedToolNames();
	let registration: AbortController | null = null;
	let stopped = false;
	let registeredDescriptors = '';
	let siteTools: WebMCPToolDescriptor[] = [];

	async function register(tools: WebMCPToolDescriptor[]) {
		if (stopped || !modelContext) {
			return;
		}
		// Registration is asynchronous, so a burst of announcements could
		// otherwise re-register an unchanged list several times over.
		const descriptors = JSON.stringify(tools);
		if (descriptors === registeredDescriptors) {
			return;
		}
		registeredDescriptors = descriptors;

		registration?.abort();
		registration = new AbortController();
		const { signal } = registration;

		for (const tool of tools) {
			if (reserved.has(tool.name)) {
				logger.warn(
					`Skipping the WebMCP tool "${tool.name}" registered by ` +
						`the site: Playground already provides a tool under ` +
						`that name.`
				);
				continue;
			}
			try {
				await modelContext.registerTool(proxyTool(client, tool), {
					signal,
				});
			} catch (error) {
				logger.warn(
					`Failed to register the site's WebMCP tool ` +
						`"${tool.name}": ${stringifyError(error)}`
				);
			}
			if (signal.aborted) {
				return;
			}
		}
	}

	client
		.onWebMCPToolsChanged((tools: WebMCPToolDescriptor[]) => {
			siteTools = tools;
			void register(tools);
		})
		.catch((error) => {
			logger.warn("Failed to observe the site's WebMCP tools:", error);
		});

	return {
		getTools() {
			return siteTools;
		},
		isAdvertised() {
			return !!modelContext;
		},
		callTool(name, args) {
			return client.callWebMCPTool(name, args ?? {});
		},
		stop() {
			stopped = true;
			registration?.abort();
			registration = null;
			registeredDescriptors = '';
			siteTools = [];
		},
	};
}

function proxyTool(
	client: PlaygroundClient,
	tool: WebMCPToolDescriptor
): ModelContextTool {
	return {
		name: tool.name,
		description: tool.description,
		inputSchema: tool.inputSchema,
		annotations: tool.annotations,
		execute: async (input) => {
			try {
				return await client.callWebMCPTool(tool.name, input ?? {});
			} catch (error) {
				return {
					error:
						`Error running the WordPress site's "${tool.name}" ` +
						`tool: ${stringifyError(error)}`,
				};
			}
		},
	};
}
