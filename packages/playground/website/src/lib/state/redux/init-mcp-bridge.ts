import { createListenerMiddleware } from '@reduxjs/toolkit';
import type { PlaygroundReduxState, PlaygroundDispatch } from './store';
import { setOPFSSitesLoadingState } from './slice-sites';
import { createSitesAPI } from './site-management-api-middleware';
import type { McpBridgeHandle } from '@wp-playground/mcp/client';
import { registerWebMCPTools, startMcpBridge } from '@wp-playground/mcp/client';
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

		// Register WebMCP tools regardless of ?mcp=yes — they only
		// activate when navigator.modelContext is available.
		/**
		 * Wrapped in try/catch because WebMCP (navigator.modelContext) is an
		 * experimental Chrome API that is still evolving. If it changes or
		 * breaks, we must not let it crash the Playground website — the MCP
		 * integration is a progressive enhancement, not a critical feature.
		 */
		try {
			registerWebMCPTools(mcpConfig);
		} catch (error) {
			logger.warn('WebMCP registration failed:', error);
		}

		// Only start the WebSocket bridge when explicitly requested
		// via ?mcp=yes and a port is provided.
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
