import { createListenerMiddleware } from '@reduxjs/toolkit';
import type { PlaygroundReduxState, PlaygroundDispatch } from './store';
import { selectActiveSite } from './store';
import {
	selectAllSites,
	selectSiteBySlug,
	setOPFSSitesLoadingState,
	updateSiteMetadata,
} from './slice-sites';
import { persistTemporarySite } from './persist-temporary-site';
import { selectClientBySiteSlug } from './slice-clients';
import type { McpBridgeHandle } from '@wp-playground/mcp/client';
import { registerWebMCPTools, startMcpBridge } from '@wp-playground/mcp/client';
import { isMcpServerEnabled } from '../url/router';
import { logTrackingEvent } from '../../tracking';
import { logger } from '@php-wasm/logger';

export const mcpListenerMiddleware = createListenerMiddleware();

const startListening = mcpListenerMiddleware.startListening.withTypes<
	PlaygroundReduxState,
	PlaygroundDispatch
>();

startListening({
	actionCreator: setOPFSSitesLoadingState,
	effect: (_action, listenerApi) => {
		// Only start the bridge once.
		listenerApi.unsubscribe();

		const { getState, dispatch } = listenerApi;

		const mcpConfig = {
			getSites: () => {
				const state = getState();
				const allSites = selectAllSites(state);
				const active = selectActiveSite(state);
				return allSites.map((s) => ({
					slug: s.slug,
					name: s.metadata.name,
					storage: s.metadata.storage,
					isActive: s.slug === active?.slug,
				}));
			},
			getPlaygroundClient: (siteSlug: string) =>
				selectClientBySiteSlug(getState(), siteSlug),
			renameSite: async (siteSlug: string, newName: string) => {
				await dispatch(
					updateSiteMetadata({
						slug: siteSlug,
						changes: { name: newName },
					})
				);
			},
			onConnect: () => {
				logTrackingEvent('mcpConnect');
			},
			saveSite: async (siteSlug: string) => {
				const state = getState();
				const site = selectSiteBySlug(state, siteSlug);
				if (!site) {
					throw new Error(`Site not found: ${siteSlug}`);
				}
				if (site.metadata.storage !== 'none') {
					return {
						slug: siteSlug,
						storage: site.metadata.storage,
					};
				}
				await dispatch(
					persistTemporarySite(siteSlug, 'opfs', {
						skipRenameModal: true,
					})
				);
				const updatedSite = selectSiteBySlug(getState(), siteSlug);
				return {
					slug: siteSlug,
					storage: updatedSite?.metadata.storage ?? 'none',
				};
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

		// Notify the bridge when site-related state changes so it
		// can diff the site list and re-register when needed.
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
