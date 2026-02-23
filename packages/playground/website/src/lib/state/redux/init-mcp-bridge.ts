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
import { startMcpBridge } from '@wp-playground/mcp/client';

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
		const handle: McpBridgeHandle = startMcpBridge({
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
		});

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
