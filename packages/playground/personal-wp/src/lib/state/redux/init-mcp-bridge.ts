import { createListenerMiddleware } from '@reduxjs/toolkit';
import { logger } from '@php-wasm/logger';
import type { PlaygroundClient } from '@wp-playground/remote';
import type {
	McpBridgeHandle,
	WebMCPSiteToolProxy,
} from '@wp-playground/mcp/client';
import {
	getModelContext,
	registerWebMCPTools,
	startMcpBridge,
	startWebMCPSiteToolProxy,
} from '@wp-playground/mcp/client';
import { personalWPSiteSlug } from 'virtual:website-defaults';
import type { PlaygroundReduxState, PlaygroundDispatch } from './store';
import {
	selectClientBySiteSlug,
	selectClientInfoBySiteSlug,
} from './slice-clients';
import { setOPFSSitesLoadingState, updateSiteMetadata } from './slice-sites';

export const mcpBridgeMiddleware = createListenerMiddleware();

const startListening = mcpBridgeMiddleware.startListening.withTypes<
	PlaygroundReduxState,
	PlaygroundDispatch
>();

const PERSONAL_WP_MCP_SITE_SLUG = personalWPSiteSlug ?? 'default';

startListening({
	actionCreator: setOPFSSitesLoadingState,
	effect: (action, listenerApi) => {
		if (action.payload !== 'loaded') {
			return;
		}
		listenerApi.unsubscribe();

		// Capture the initial listing before a fresh browser automatically creates
		// and saves a site. Keep the connection offer for this document's lifetime.
		const hasSavedSite = Object.values(
			listenerApi.getState().sites.entities
		).some((site) => site.metadata.storage !== 'none');
		if (!hasSavedSite) {
			void registerConnectExistingSiteTool().catch((error) => {
				logger.warn('Remote access WebMCP registration failed:', error);
			});
		}
		let handle: McpBridgeHandle | null = null;
		let connectedPort: number | null = null;

		const mcpConfig = {
			list: () => {
				const clientInfo = selectClientInfoBySiteSlug(
					listenerApi.getState(),
					PERSONAL_WP_MCP_SITE_SLUG
				);
				if (!clientInfo) {
					return [];
				}
				const site =
					listenerApi.getState().sites.entities[
						PERSONAL_WP_MCP_SITE_SLUG
					];
				if (!site) {
					return [];
				}
				return [
					{
						slug: PERSONAL_WP_MCP_SITE_SLUG,
						name: site.metadata.name,
						storage:
							site.metadata.storage === 'none'
								? 'temporary'
								: site.metadata.storage,
						isActive: true,
					},
				];
			},
			getClient: (): PlaygroundClient | undefined => {
				const state = listenerApi.getState();
				const clientInfo = selectClientInfoBySiteSlug(
					state,
					PERSONAL_WP_MCP_SITE_SLUG
				);
				if (!clientInfo) {
					return undefined;
				}
				return selectClientBySiteSlug(state, PERSONAL_WP_MCP_SITE_SLUG);
			},
			rename: async (newName: string): Promise<void> => {
				const site =
					listenerApi.getState().sites.entities[
						PERSONAL_WP_MCP_SITE_SLUG
					];
				if (!site) {
					throw new Error('Personal WordPress site is not loaded');
				}
				if (site.metadata.storage === 'none') {
					throw new Error(
						'Cannot rename a temporary site. Save it first.'
					);
				}
				await listenerApi.dispatch(
					updateSiteMetadata({
						slug: site.slug,
						metadata: { name: newName },
					})
				);
			},
			saveInBrowser: async (): Promise<{
				slug: string;
				storage: string;
			}> => {
				const site =
					listenerApi.getState().sites.entities[
						PERSONAL_WP_MCP_SITE_SLUG
					];
				if (!site) {
					throw new Error('Personal WordPress site is not loaded');
				}
				if (site.metadata.storage === 'none') {
					throw new Error(
						'Personal Playground sites are temporary in this ' +
							'configuration and cannot be saved via MCP.'
					);
				}
				return {
					slug: PERSONAL_WP_MCP_SITE_SLUG,
					storage: site.metadata.storage,
				};
			},
		};

		void registerWebMCPTools(mcpConfig).catch((error) => {
			logger.warn('WebMCP registration failed:', error);
		});

		/**
		 * Mirrors the WebMCP tools a plugin registers inside the WordPress
		 * document onto this page, so an agent driving Playground can call
		 * them. The proxy is tied to one client, so it restarts whenever the
		 * site is booted or replaced.
		 */
		let siteToolProxy: WebMCPSiteToolProxy | null = null;
		let proxiedClient: PlaygroundClient | undefined;
		const syncSiteToolProxy = () => {
			const client = mcpConfig.getClient();
			if (client === proxiedClient) {
				return;
			}
			proxiedClient = client;
			siteToolProxy?.stop();
			siteToolProxy = client ? startWebMCPSiteToolProxy(client) : null;
		};
		syncSiteToolProxy();

		const getRequestedMcpPort = (): number | null => {
			const mcpPort = new URLSearchParams(window.location.search).get(
				'mcp-port'
			);
			if (!mcpPort) {
				return null;
			}
			const port = Number(mcpPort);
			return Number.isFinite(port) ? port : null;
		};

		const startLocalBridge = (port: number) => {
			if (connectedPort === port && handle) {
				handle.notifySitesChanged();
				return;
			}
			handle?.stop();
			handle = startMcpBridge(mcpConfig, port);
			connectedPort = port;
		};

		const syncMcpBridge = () => {
			const port = getRequestedMcpPort();
			if (!port) {
				return;
			}

			const clientInfo = selectClientInfoBySiteSlug(
				listenerApi.getState(),
				PERSONAL_WP_MCP_SITE_SLUG
			);
			if (!clientInfo) {
				return;
			}

			startLocalBridge(port);
		};

		if (getRequestedMcpPort()) {
			syncMcpBridge();
		}

		startListening({
			predicate: (action) =>
				typeof action.type === 'string' &&
				(action.type.startsWith('clients/') ||
					action.type.startsWith('sites/') ||
					action.type === 'ui/setActiveSite'),
			effect: () => {
				syncMcpBridge();
				syncSiteToolProxy();
				handle?.notifySitesChanged();
			},
		});
	},
});

async function registerConnectExistingSiteTool(): Promise<void> {
	await getModelContext()?.registerTool({
		name: 'my_wordpress_connect_existing_site',
		description:
			'Connect to the user’s existing WordPress in another browser. ' +
			'No saved site was found in this browser when this page opened. ' +
			'My WordPress stores sites in each browser separately; a site created ' +
			'here may not be the user’s existing site. If the user asks to add ' +
			'content to or update their existing WordPress, offer Remote Access ' +
			'and use this tool to open /connect. Ask the user to open My WordPress ' +
			'in their usual browser, start Remote Access from Site Tools, and ' +
			'provide the access code or link. Continue their original task after ' +
			'connecting. If the user wants a new site in this browser, use the ' +
			'local site tools instead.',
		inputSchema: {
			type: 'object',
			properties: {},
			additionalProperties: false,
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
		},
		execute: async () => {
			window.location.href = '/connect';
			return {
				status: 'connection_required',
				guidance:
					'Ask the user to start Remote Access from Site Tools in the ' +
					'browser where their WordPress lives and provide the access ' +
					'code or link. Enter the code on /connect, then ask the user ' +
					'to approve access on the host device.',
			};
		},
	});
}
