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
	registerWebMCPTools,
	startMcpBridge,
	startWebMCPSiteToolProxy,
} from '@wp-playground/mcp/client';
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
		void registerWebMCPTools(mcpConfig).catch((error) => {
			logger.warn('WebMCP registration failed:', error);
		});

		/**
		 * Mirrors the WebMCP tools a plugin registers inside the WordPress
		 * document onto this page, so an agent driving Playground can call
		 * them.
		 *
		 * A tab shows one site at a time, so the proxy follows the active
		 * site's client and restarts when the user switches sites or the site
		 * reboots. Tool names need no per-site qualifier for the same reason.
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
			siteToolProxy = client ? startWebMCPSiteToolProxy(client) : null;
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
