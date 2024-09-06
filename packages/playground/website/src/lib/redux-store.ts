import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';

import {
	type SiteInfo,
	listSites,
	addSite as addSiteToStorage,
	removeSite as removeSiteFromStorage,
} from './site-storage';
import type { MountDevice } from '@php-wasm/web';
import { PlaygroundClient } from '@wp-playground/client';
import { useDispatch, useSelector } from 'react-redux';

export type ActiveModal =
	| 'error-report'
	| 'log'
	| 'start-error'
	| 'mount-markdown-directory'
	| false;

export type SiteListingStatus =
	| {
			type: 'uninitialized';
	  }
	| {
			type: 'loading';
			// TODO
			//progress: number,
			//total?: number,
	  }
	| {
			type: 'loaded';
	  }
	| {
			type: 'error';
			error: string;
	  };

export type SiteListing = {
	status: SiteListingStatus;
	sites: SiteInfo[];
};

export interface ClientInfo {
	client: PlaygroundClient;
	url: string;
	opfsMountDescriptor?: {
		device: MountDevice;
		mountpoint: string;
	};
}

// Define the state types
interface AppState {
	activeSite?: SiteInfo;
	activeModal: string | null;
	offline: boolean;
	siteListing: SiteListing;
	clients: Record<string, ClientInfo>;
	siteManagerIsOpen: boolean;
}

const query = new URL(document.location.href).searchParams;

// Define the initial state
const initialState: AppState = {
	activeModal:
		query.get('modal') === 'mount-markdown-directory'
			? 'mount-markdown-directory'
			: null,
	offline: !navigator.onLine,
	clients: {},
	siteListing: {
		status: { type: 'loading' },
		sites: [],
	},
	siteManagerIsOpen: false,
};

// Create the slice
const slice = createSlice({
	name: 'app',
	initialState,
	reducers: {
		setActiveSite: (state, action: PayloadAction<SiteInfo>) => {
			state.activeSite = action.payload;
		},
		forgetClientInfo: (state, action: PayloadAction<string>) => {
			delete state.clients[action.payload];
		},
		setClientInfo: (
			state,
			action: PayloadAction<{
				siteSlug: string;
				info: Partial<ClientInfo>;
			}>
		) => {
			const siteSlug = action.payload.siteSlug;
			const clientInfo = action.payload.info;
			if (!state.clients[siteSlug]) {
				if (clientInfo.client!) {
					state.clients[siteSlug] = {
						url: '/',
						...clientInfo,
					} as ClientInfo;
				}
				return;
			}

			for (const [key, value] of Object.entries(clientInfo)) {
				if (value === undefined) {
					delete state.clients[siteSlug][key as keyof ClientInfo];
				} else {
					state.clients[siteSlug][key as keyof ClientInfo] =
						value as any;
				}
			}
		},
		setActiveModal: (state, action: PayloadAction<string | null>) => {
			state.activeModal = action.payload;
		},
		setOfflineStatus: (state, action: PayloadAction<boolean>) => {
			state.offline = action.payload;
		},
		setSiteListingLoaded: (state, action: PayloadAction<SiteInfo[]>) => {
			state.siteListing = {
				status: { type: 'loaded' },
				sites: action.payload,
			};
		},
		setSiteListingError: (state, action: PayloadAction<string>) => {
			state.siteListing = {
				status: {
					type: 'error',
					error: action.payload,
				},
				sites: [],
			};
		},
		addSite: (state, action: PayloadAction<SiteInfo>) => {
			state.siteListing.sites.push(action.payload);
		},
		removeSite: (state, action: PayloadAction<SiteInfo>) => {
			const idToRemove = action.payload.id;
			const siteIndex = state.siteListing.sites.findIndex(
				(siteInfo) => siteInfo.id === idToRemove
			);
			if (siteIndex !== undefined) {
				state.siteListing.sites.splice(siteIndex, 1);
			}
		},
		setSiteManagerIsOpen: (state, action: PayloadAction<boolean>) => {
			state.siteManagerIsOpen = action.payload;
		},
	},
});

// Export actions
export const {
	setActiveModal,
	setClientInfo,
	forgetClientInfo,
	setActiveSite,
	setSiteManagerIsOpen,
} = slice.actions;

export const getActiveClient = (
	state: PlaygroundReduxState
): ClientInfo | undefined =>
	state.activeSite ? state.clients[state.activeSite.slug] : undefined;

// Redux thunk for adding a site
export function createSite(siteInfo: SiteInfo) {
	return async (dispatch: typeof store.dispatch) => {
		// TODO: Handle errors
		// TODO: Possibly reflect addition in progress
		await addSiteToStorage(siteInfo);
		dispatch(slice.actions.addSite(siteInfo));
	};
}

// Redux thunk for removing a site
export function deleteSite(site: SiteInfo) {
	return async (dispatch: typeof store.dispatch) => {
		// TODO: Handle errors
		// TODO: Possibly reflect removal in progress
		await removeSiteFromStorage(site);
		dispatch(slice.actions.removeSite(site));
	};
}

// Configure store
const store = configureStore({
	reducer: slice.reducer,
	middleware: (getDefaultMiddleware) =>
		getDefaultMiddleware({
			serializableCheck: {
				// Ignore these action types
				ignoredActions: [
					'setOpfsMountDescriptor',
					'app/setPlaygroundClient',
					'app/setActiveSite',
				],
				// Ignore these field paths in all actions
				ignoredActionPaths: ['payload.handle', 'payload.info.client'],
				// Ignore these paths in the state
				ignoredPaths: ['opfsMountDescriptor.handle', 'clients'],
			},
		}),
});

function setupOnlineOfflineListeners(dispatch: PlaygroundDispatch) {
	window.addEventListener('online', () => {
		dispatch(slice.actions.setOfflineStatus(false));
	});
	window.addEventListener('offline', () => {
		dispatch(slice.actions.setOfflineStatus(true));
	});
}
setupOnlineOfflineListeners(store.dispatch);

// NOTE: We will likely want to configure and list sites someplace else,
// but for now, it seems fine to just kick off loading from OPFS
// after the store is created.
listSites().then(
	(sites) => store.dispatch(slice.actions.setSiteListingLoaded(sites)),
	(error) =>
		store.dispatch(
			slice.actions.setSiteListingError(
				error instanceof Error ? error.message : 'Unknown error'
			)
		)
);

export function useAppSelector<T>(
	selector: (state: PlaygroundReduxState) => T
): T {
	return useSelector(selector);
}

export function useAppDispatch() {
	return useDispatch<PlaygroundDispatch>();
}

// Define RootState type
export type PlaygroundReduxState = ReturnType<typeof store.getState>;

// Define AppDispatch type
export type PlaygroundDispatch = typeof store.dispatch;

export default store;
