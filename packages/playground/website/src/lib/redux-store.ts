import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';

import {
	type SiteInfo,
	listSites,
	addSite as addSiteToStorage,
	removeSite as removeSiteFromStorage,
	getDirectoryNameForSlug,
} from './site-storage';
import type { MountDevice, SyncProgress } from '@php-wasm/web';
import { PlaygroundClient } from '@wp-playground/client';
import { useDispatch, useSelector } from 'react-redux';
import { updateUrl } from './router-hooks';

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
	opfsIsSyncing?: boolean;
	opfsSyncProgress?: SyncProgress;
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
		updateClientInfo: (
			state,
			action: PayloadAction<{
				siteSlug: string;
				info: Partial<ClientInfo>;
			}>
		) => {
			const siteSlug = action.payload.siteSlug;
			if (!state.clients[siteSlug]) {
				state.clients[siteSlug] = {
					url: '/',
				} as ClientInfo;
			}
			state.clients[siteSlug] = {
				...state.clients[siteSlug],
				...action.payload.info,
			};
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
				sites: [...action.payload, ...state.siteListing.sites],
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
		updateSite: (
			state,
			action: PayloadAction<Partial<SiteInfo> & { slug: string }>
		) => {
			const siteIndex = state.siteListing.sites.findIndex(
				(siteInfo) => siteInfo.slug === action.payload.slug
			);
			const site = state.siteListing.sites[siteIndex];
			if (!site) {
				// @TODO: Handle errors?
				return;
			}
			state.siteListing.sites[siteIndex] = recursiveMerge(
				site,
				action.payload
			);
		},
		addSite: (state, action: PayloadAction<SiteInfo>) => {
			state.siteListing.sites.push(action.payload);
			console.log('added site', { action });
		},
		removeSite: (state, action: PayloadAction<SiteInfo>) => {
			const idToRemove = action.payload.metadata.id;
			const siteIndex = state.siteListing.sites.findIndex(
				(siteInfo) => siteInfo.metadata.id === idToRemove
			);
			if (siteIndex !== undefined) {
				state.siteListing.sites.splice(siteIndex, 1);
			}
			console.log('removed site', { action });
		},
		setSiteManagerIsOpen: (state, action: PayloadAction<boolean>) => {
			state.siteManagerIsOpen = action.payload;
		},
	},
});

function recursiveMerge<T extends Record<string, any>>(
	original: T,
	updated: Partial<T>
): T {
	for (const [key, value] of Object.entries(updated)) {
		if (typeof value === 'object' && value !== null) {
			(original as any)[key] = recursiveMerge(original[key] || {}, value);
		} else if (value === undefined) {
			delete (original as any)[key];
		} else {
			(original as any)[key] = value;
		}
	}
	return original;
}

// Export actions
export const {
	setActiveModal,
	updateClientInfo,
	forgetClientInfo,
	setActiveSite,
	setSiteManagerIsOpen,
	updateSite,
} = slice.actions;

export const getActiveClient = (
	state: PlaygroundReduxState
): ClientInfo | undefined =>
	state.activeSite ? state.clients[state.activeSite.slug] : undefined;

// Redux thunk
export function saveSiteToDevice(
	siteSlug: string,
	device: 'opfs' | (MountDevice & { type: 'local-fs' })
) {
	return async (
		dispatch: typeof store.dispatch,
		getState: () => PlaygroundReduxState
	) => {
		// @TODO: Handle errors

		const state = getState();
		const playground = state.clients[siteSlug].client;
		if (!playground) {
			throw new Error(
				`Site ${siteSlug} must have an active client to be saved to OPFS, but none was found.`
			);
		}

		const mountDescriptor = {
			device:
				device === 'opfs'
					? ({
							type: 'opfs',
							path: '/' + getDirectoryNameForSlug(siteSlug),
					  } as const)
					: device,
			mountpoint: '/wordpress',
		} as const;

		dispatch(
			updateClientInfo({
				siteSlug: siteSlug,
				info: {
					opfsMountDescriptor: mountDescriptor,
					opfsIsSyncing: true,
				},
			})
		);
		try {
			await playground!.mountOpfs(
				{
					...mountDescriptor,
					initialSyncDirection: 'memfs-to-opfs',
				},
				(progress) => {
					dispatch(
						updateClientInfo({
							siteSlug: siteSlug,
							info: {
								opfsSyncProgress: progress,
							},
						})
					);
				}
			);
		} finally {
			// @TODO: Tell the user the operation is complete
			dispatch(
				updateClientInfo({
					siteSlug: siteSlug,
					info: {
						opfsIsSyncing: false,
						opfsSyncProgress: undefined,
					},
				})
			);
		}
		dispatch(
			updateSite({
				slug: siteSlug,
				storage: device === 'opfs' ? 'opfs' : 'local-fs',
			})
		);
		window.history.pushState(
			{},
			'',
			updateUrl(window.location.href, {
				searchParams: {
					'site-slug': siteSlug,
				},
			})
		);
	};
}

// Redux thunk
export function createSite(siteInfo: SiteInfo) {
	return async (dispatch: typeof store.dispatch) => {
		// TODO: Handle errors
		// TODO: Possibly reflect addition in progress
		if (siteInfo.storage === 'opfs') {
			await addSiteToStorage(siteInfo);
		}
		console.log('creating site', { siteInfo });
		dispatch(slice.actions.addSite(siteInfo));
	};
}

// Redux thunk
export function deleteSite(siteInfo: SiteInfo) {
	return async (dispatch: typeof store.dispatch) => {
		// TODO: Handle errors
		// TODO: Possibly reflect removal in progress
		if (siteInfo.storage === 'opfs') {
			await removeSiteFromStorage(siteInfo);
		}
		dispatch(slice.actions.removeSite(siteInfo));
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
