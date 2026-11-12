import { createListenerMiddleware } from '@reduxjs/toolkit';
import type { PlaygroundReduxState, PlaygroundDispatch } from './store';
import { setOPFSSitesLoadingState } from './slice-sites';
import { createSitesAPI } from './site-management-api-middleware';
import type { PlaygroundClient } from '@wp-playground/remote';
import type {
	McpBridgeHandle,
	WebMCPSiteToolProxy,
} from '@wp-playground/mcp/client';
import {
	createWebMCPSiteAccess,
	registerWebMCPTools,
	startMcpBridge,
	startWebMCPSiteToolGateway,
} from '@wp-playground/mcp/client';
import {
	agentSiteAccessPrompt,
	setAgentSiteAccess,
} from '../../agent-site-access';
import { isMcpServerEnabled } from '../url/router';
import { logTrackingEvent } from '../../tracking';
import { logger } from '@php-wasm/logger';

export const mcpBridgeMiddleware = createListenerMiddleware();

const startListening = mcpBridgeMiddleware.startListening.withTypes<
	PlaygroundReduxState,
	PlaygroundDispatch
>();

startListening({
	actionCreator: setOPFSSitesLoadingState,
	effect: (_action, listenerApi) => {
		listenerApi.unsubscribe();

		const sitesAPI = createSitesAPI(
			listenerApi.getState,
			listenerApi.dispatch
		);

		const mcpConfig = {
			list: sitesAPI.list,
			getClient: sitesAPI.getClient,
			rename: sitesAPI.rename,
			saveInBrowser: sitesAPI.saveInBrowser,
			onConnect: () => {
				logTrackingEvent('mcpConnect');
			},
		};

		// Register WebMCP tools regardless of ?mcp-port — they only
		// activate when document.modelContext is available.
		/**
		 * Catch failures because WebMCP (document.modelContext) is an
		 * experimental Chrome API that is still evolving. If it changes or
		 * breaks, we must not let it crash the Playground website — the MCP
		 * integration is a progressive enhancement, not a critical feature.
		 */
		const webMCPConfig = {
			...mcpConfig,
			confirmSiteAccess: agentSiteAccessPrompt.confirm,
			switchSite: (siteSlug: string) => sitesAPI.setActiveSite(siteSlug),
		};
		const siteAccess = createWebMCPSiteAccess(webMCPConfig);
		setAgentSiteAccess(siteAccess);
		void registerWebMCPTools({ ...webMCPConfig, siteAccess }).catch(
			(error) => {
				logger.warn('WebMCP registration failed:', error);
			}
		);

		/**
		 * Makes the WebMCP tools a plugin registers inside the WordPress
		 * document reachable through Playground's site tool gateway.
		 *
		 * Site tools act only on the current site, so the gateway follows the
		 * active site's client and restarts when the user switches sites or
		 * the site reboots.
		 */
		let siteToolProxy: WebMCPSiteToolProxy | null = null;
		let proxiedClient: PlaygroundClient | undefined;
		const syncSiteToolProxy = () => {
			let client: PlaygroundClient | undefined;
			try {
				client = mcpConfig.getClient();
			} catch {
				// No site is selected yet.
				client = undefined;
			}
			if (client === proxiedClient) {
				return;
			}
			proxiedClient = client;
			siteToolProxy?.stop();
			siteToolProxy = client ? startWebMCPSiteToolGateway(client) : null;
		};
		syncSiteToolProxy();

		startListening({
			predicate: (action) =>
				typeof action.type === 'string' &&
				(action.type.startsWith('clients/') ||
					action.type.startsWith('sites/') ||
					action.type === 'ui/setActiveSite'),
			effect: syncSiteToolProxy,
		});

		// Deleting a site revokes this tab's grants for it.
		startListening({
			predicate: (action) =>
				typeof action.type === 'string' &&
				action.type.startsWith('sites/'),
			effect: () => {
				void siteAccess.sitesChanged().catch((error) => {
					logger.warn('Failed to update agent site access:', error);
				});
			},
		});

		// Only start the WebSocket bridge when explicitly requested
		// via ?mcp-port.
		if (!isMcpServerEnabled()) {
			return;
		}

		const mcpPort = new URLSearchParams(window.location.search).get(
			'mcp-port'
		);
		if (!mcpPort) {
			return;
		}

		const handle: McpBridgeHandle = startMcpBridge(
			mcpConfig,
			Number(mcpPort)
		);

		startListening({
			predicate: (action) =>
				typeof action.type === 'string' &&
				(action.type.startsWith('sites/') ||
					action.type === 'ui/setActiveSite'),
			effect: () => {
				handle.notifySitesChanged();
			},
		});
	},
});
