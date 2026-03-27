import { configureStore, createSelector } from '@reduxjs/toolkit';
import type { SiteError, SerializedSiteErrorDetails } from './slice-ui';
import uiReducer, {
	__internal_uiSlice,
	listenToOnlineOfflineEventsMiddleware,
} from './slice-ui';
import { mcpListenerMiddleware } from './init-mcp-bridge';
import type { SiteInfo } from './slice-sites';
import sitesReducer, {
	selectSiteBySlug,
	selectTemporarySites,
} from './slice-sites';
import { PlaygroundRoute, redirectTo } from '../url/router';
import type { ClientInfo } from './slice-clients';
import clientsReducer, { selectAllClientInfo } from './slice-clients';
import { useDispatch, useSelector } from 'react-redux';

// NOTE: A GetDefaultMiddleware type is not exported from @reduxjs/toolkit,
// so we have to derive it from the configureStore() signature.
type ConfigureStoreOptions<T> = Parameters<typeof configureStore<T>>[0];
type ConfigureStoreOptionsMiddleware<T> = NonNullable<
	ConfigureStoreOptions<T>['middleware']
>;
type GetDefaultMiddleware<T> = Parameters<
	ConfigureStoreOptionsMiddleware<T>
>[0];

function ignoreSerializableCheck<S>(
	getDefaultMiddleware: GetDefaultMiddleware<S>
) {
	return getDefaultMiddleware({
		serializableCheck: {
			// Ignore these action types
			ignoredActions: [
				'clients/addClientInfo',
				'clients/updateClientInfo',
				'sites/addSite',
				'sites/setFirstTemporarySiteCreated',
				'ui/setActiveSite',
			],
			// Ignore these field paths in all actions
			ignoredActionPaths: [
				/payload\.(changes\.)?client/,
				/payload\.(changes\.)?opfsMountDescriptor\.device\.handle/,
				/.+\.originalBlueprint/,
			],
			// Ignore these paths in the state
			ignoredPaths: [
				/clients\.entities\.[^.]+\.client/,
				/clients\.entities\.[^.]+\.opfsMountDescriptor\.device\.handle/,
				/.+\.originalBlueprint/,
			],
		},
	});
}

const store = configureStore({
	reducer: {
		ui: uiReducer,
		sites: sitesReducer,
		clients: clientsReducer,
	},
	middleware: (getDefaultMiddleware) =>
		ignoreSerializableCheck(getDefaultMiddleware)
			.concat(listenToOnlineOfflineEventsMiddleware)
			.concat(mcpListenerMiddleware.middleware),
});

export type RootState = ReturnType<typeof store.getState>;

export function useAppSelector<T>(
	selector: (state: PlaygroundReduxState) => T
): T {
	return useSelector(selector);
}

export function useAppDispatch() {
	return useDispatch<PlaygroundDispatch>();
}

export const selectActiveSite = (
	state: PlaygroundReduxState
): SiteInfo | undefined =>
	state.ui.activeSite?.slug
		? state.sites.entities[state.ui.activeSite.slug]
		: undefined;

export const selectActiveSiteError = (
	state: PlaygroundReduxState
): SiteError | undefined =>
	state.ui.activeSite?.slug ? state.ui.activeSite.error : undefined;

export const selectActiveSiteErrorDetails = (
	state: PlaygroundReduxState
): SerializedSiteErrorDetails | undefined =>
	state.ui.activeSite?.slug ? state.ui.activeSite.errorDetails : undefined;

export const useActiveSite = () => useAppSelector(selectActiveSite);

export const setActiveSite = (slug: string | undefined) => {
	return (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		// Short-circuit if the provided slug already points to the active site.
		const activeSite = selectActiveSite(getState());
		if (activeSite?.slug === slug) {
			return;
		}
		dispatch(__internal_uiSlice.actions.setActiveSite(slug));
		if (slug) {
			const site = selectSiteBySlug(getState(), slug);
			redirectTo(PlaygroundRoute.site(site));
		}
	};
};

export const getActiveClientInfo = (
	state: PlaygroundReduxState
): ClientInfo | undefined =>
	state.ui.activeSite?.slug
		? state.clients.entities[state.ui.activeSite.slug]
		: undefined;

export const selectBootedTemporarySites = createSelector(
	selectAllClientInfo,
	selectTemporarySites,
	(clientInfo, temporarySites) => {
		return temporarySites.filter((site) =>
			clientInfo.some((client) => client.siteSlug === site.slug)
		);
	}
);

// Define RootState type
export type PlaygroundReduxState = ReturnType<typeof store.getState>;

// Define AppDispatch type
export type PlaygroundDispatch = typeof store.dispatch;

export default store;
