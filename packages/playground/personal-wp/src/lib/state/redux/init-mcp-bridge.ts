import { createListenerMiddleware } from '@reduxjs/toolkit';
import { logger } from '@php-wasm/logger';
import type { PlaygroundClient } from '@wp-playground/remote';
import type { McpBridgeHandle } from '@wp-playground/mcp/client';
import { registerWebMCPTools, startMcpBridge } from '@wp-playground/mcp/client';
import { personalWPSiteSlug } from 'virtual:website-defaults';
import type { PlaygroundReduxState, PlaygroundDispatch } from './store';
import {
	selectClientBySiteSlug,
	selectClientInfoBySiteSlug,
} from './slice-clients';
import { setOPFSSitesLoadingState, updateSiteMetadata } from './slice-sites';
import {
	requestRemoteMcpConnect,
	setMcpConnectRequestCallback,
} from './tab-coordinator';

export const mcpBridgeMiddleware = createListenerMiddleware();

const startListening = mcpBridgeMiddleware.startListening.withTypes<
	PlaygroundReduxState,
	PlaygroundDispatch
>();

const PERSONAL_WP_MCP_SITE_SLUG = personalWPSiteSlug ?? 'default';

startListening({
	actionCreator: setOPFSSitesLoadingState,
	effect: (_action, listenerApi) => {
		listenerApi.unsubscribe();
		let handle: McpBridgeHandle | null = null;
		let connectedPort: number | null = null;
		let requestedRemotePort: number | null = null;

		const mcpConfig = {
			list: () => {
				const clientInfo = selectClientInfoBySiteSlug(
					listenerApi.getState(),
					PERSONAL_WP_MCP_SITE_SLUG
				);
				if (!clientInfo || clientInfo.isDependentMode) {
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
				if (!clientInfo || clientInfo.isDependentMode) {
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

		try {
			registerWebMCPTools(mcpConfig);
		} catch (error) {
			logger.warn('WebMCP registration failed:', error);
		}

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

		const registerMcpConnectRequestCallback = () => {
			setMcpConnectRequestCallback((port) => {
				const clientInfo = selectClientInfoBySiteSlug(
					listenerApi.getState(),
					PERSONAL_WP_MCP_SITE_SLUG
				);
				if (!clientInfo || clientInfo.isDependentMode) {
					return;
				}
				startLocalBridge(port);
			});
		};

		registerMcpConnectRequestCallback();

		const syncMcpBridge = () => {
			registerMcpConnectRequestCallback();
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
			if (clientInfo.isDependentMode) {
				handle?.stop();
				handle = null;
				connectedPort = null;
				if (
					clientInfo.mainTabStatus === 'connected' &&
					requestedRemotePort !== port
				) {
					requestedRemotePort = port;
					requestRemoteMcpConnect(PERSONAL_WP_MCP_SITE_SLUG, port);
				}
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
				handle?.notifySitesChanged();
			},
		});
	},
});
