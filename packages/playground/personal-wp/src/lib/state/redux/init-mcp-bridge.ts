import { createListenerMiddleware } from '@reduxjs/toolkit';
import { logger } from '@php-wasm/logger';
import type { PlaygroundClient } from '@wp-playground/remote';
import type { McpBridgeHandle } from '@wp-playground/mcp/client';
import { registerWebMCPTools, startMcpBridge } from '@wp-playground/mcp/client';
import type { PlaygroundReduxState, PlaygroundDispatch } from './store';
import { selectClientBySiteSlug } from './slice-clients';
import {
	selectAllSites,
	setOPFSSitesLoadingState,
	updateSiteMetadata,
} from './slice-sites';

export const mcpBridgeMiddleware = createListenerMiddleware();

const startListening = mcpBridgeMiddleware.startListening.withTypes<
	PlaygroundReduxState,
	PlaygroundDispatch
>();

function selectActiveSite(state: PlaygroundReduxState) {
	return state.ui.activeSite?.slug
		? state.sites.entities[state.ui.activeSite.slug]
		: undefined;
}

startListening({
	actionCreator: setOPFSSitesLoadingState,
	effect: (_action, listenerApi) => {
		listenerApi.unsubscribe();

		const mcpConfig = {
			list: () => {
				const state = listenerApi.getState();
				const activeSite = selectActiveSite(state);
				return selectAllSites(state).map((site) => ({
					slug: site.slug,
					name: site.metadata.name,
					storage:
						site.metadata.storage === 'none'
							? 'temporary'
							: site.metadata.storage,
					isActive: site.slug === activeSite?.slug,
				}));
			},
			getClient: (): PlaygroundClient | undefined => {
				const state = listenerApi.getState();
				const site = selectActiveSite(state);
				if (!site) {
					throw new Error('No active site selected');
				}
				return selectClientBySiteSlug(state, site.slug);
			},
			rename: async (newName: string): Promise<void> => {
				const site = selectActiveSite(listenerApi.getState());
				if (!site) {
					throw new Error('No active site selected');
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
				const site = selectActiveSite(listenerApi.getState());
				if (!site) {
					throw new Error('No active site selected');
				}
				if (site.metadata.storage === 'none') {
					throw new Error(
						'Personal Playground sites are temporary in this ' +
							'configuration and cannot be saved via MCP.'
					);
				}
				return {
					slug: site.slug,
					storage: site.metadata.storage,
				};
			},
		};

		try {
			registerWebMCPTools(mcpConfig);
		} catch (error) {
			logger.warn('WebMCP registration failed:', error);
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
