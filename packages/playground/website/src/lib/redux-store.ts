import {
	configureStore,
	createSlice,
	PayloadAction,
	createAsyncThunk,
	createEntityAdapter,
	combineSlices,
} from '@reduxjs/toolkit';

import {
	type SiteInfo,
	listSites,
	addSite as addSiteToStorage,
	removeSite as removeSiteFromStorage,
} from './site-storage';
import {
	directoryHandleFromMountDevice,
	directoryHandleToOpfsPath,
} from '@wp-playground/storage';
import type { MountDevice } from '@php-wasm/web';
import { logger } from '@php-wasm/logger';
import {
	Blueprint,
	PlaygroundClient,
	startPlaygroundWeb,
} from '@wp-playground/client';
import { getRemoteUrl } from './config';
import { playgroundAvailableInOpfs } from '../components/playground-configuration-group/playground-available-in-opfs';
import { useDispatch } from 'react-redux';

// -----------------------------------------
// Playground slice
// -----------------------------------------

// Define the state types
type SiteId = string;
type OPFSMountDescriptor = {
	device: MountDevice;
	mountpoint: string;
};

type SiteClient = {
	siteId: SiteId;
	lastUrl?: string;
	client?: PlaygroundClient;
	state: 'initializing' | 'ready' | 'error';
};

export const playgroundsAdapter = createEntityAdapter({
	selectId: (siteClient: SiteClient) => siteClient.siteId,
});

export const bootPlayground = createAsyncThunk<
	void,
	{
		siteId: SiteId;
		blueprint: Blueprint;
		iframe: HTMLIFrameElement;
		opfsMount?: OPFSMountDescriptor;
	}
>('app/startPlayground', async (payload, thunkAPI) => {
	const { siteId, blueprint, iframe, opfsMount } = payload;
	thunkAPI.dispatch(
		playgroundSlice.actions.addOne({
			siteId,
			state: 'initializing',
		})
	);

	let isWordPressInstalled = false;
	if (opfsMount) {
		isWordPressInstalled = await playgroundAvailableInOpfs(
			await directoryHandleFromMountDevice(opfsMount.device)
		);
	}

	try {
		await startPlaygroundWeb({
			iframe: iframe!,
			remoteUrl: getRemoteUrl().toString(),
			blueprint,
			// Intercept the Playground client even if the
			// Blueprint fails.
			onClientConnected: (playground) => {
				// The logic is in this callback because it's called
				// earlier than startPlaygroundWeb finishes. We can
				// already start communicating progress information
				// to the user without waiting for the boot process
				// to be 100% finished.
				thunkAPI.dispatch(
					playgroundSlice.actions.updateOne({
						id: siteId,
						changes: {
							client: playground,
							state: 'ready',
						},
					})
				);
				playground.onNavigation((url: string) =>
					thunkAPI.dispatch(
						playgroundSlice.actions.updateOne({
							id: siteId,
							changes: {
								lastUrl: url,
							},
						})
					)
				);
				(window as any)['playground'] = playground;
			},
			mounts: opfsMount
				? [
						{
							...opfsMount,
							initialSyncDirection: 'opfs-to-memfs',
						},
				  ]
				: [],
			shouldInstallWordPress: !isWordPressInstalled,
		});
	} catch (error) {
		logger.error(error);
		thunkAPI.dispatch(setActiveModal('start-error'));
		thunkAPI.dispatch(
			playgroundSlice.actions.updateOne({
				id: siteId,
				changes: {
					client: undefined,
					state: 'error',
				},
			})
		);
	}
});

export type SiteClientState = 'missing' | SiteClient['state'];
const playgroundSlice = createSlice({
	name: 'clients',
	initialState: playgroundsAdapter.getInitialState(),
	selectors: {
		...playgroundsAdapter.getSelectors(),
		getClientState(state, siteId): SiteClientState {
			const client = playgroundsAdapter
				.getSelectors()
				.selectById(state, siteId);
			if (!client) {
				return 'missing';
			}
			return client.state;
		},
	},
	reducers: {
		addOne: playgroundsAdapter.addOne,
		removeOne: playgroundsAdapter.removeOne,
		updateOne: playgroundsAdapter.updateOne,
	},
});

export const { getClientState, selectById: getSiteClient } =
	playgroundSlice.selectors;

// -----------------------------------------
// App slice
// -----------------------------------------

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

interface AppState {
	activeSiteSlug: string | undefined;
	activeModal: string | null;
	offline: boolean;
	siteListing: SiteListing;
	opfsMountDescriptor?: OPFSMountDescriptor;
}

const query = new URL(document.location.href).searchParams;

const initialState: AppState = {
	activeSiteSlug: query.get('site-slug') || undefined,
	activeModal:
		query.get('modal') === 'mount-markdown-directory'
			? 'mount-markdown-directory'
			: null,
	offline: !navigator.onLine,
	siteListing: {
		status: { type: 'loading' },
		sites: [],
	},
};

// Define the initial state
if (query.get('storage') === 'browser') {
	const siteSlug = query.get('site-slug') || 'wordpress';
	const opfsRoot = await navigator.storage.getDirectory();
	const opfsDir = await opfsRoot.getDirectoryHandle(
		siteSlug === 'wordpress' ? siteSlug : 'site-' + siteSlug,
		{
			create: true,
		}
	);

	initialState.opfsMountDescriptor = {
		device: {
			type: 'opfs',
			path: await directoryHandleToOpfsPath(opfsDir),
		},
		mountpoint: '/wordpress',
	};
}

const appSlice = createSlice({
	name: 'app',
	initialState,
	selectors: {
		getOpfsHandle: (state) => state.opfsMountDescriptor,
	},
	reducers: {
		setActiveSiteSlug: (
			state,
			action: PayloadAction<string | undefined>
		) => {
			state.activeSiteSlug = action.payload;
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
		setOpfsMountDescriptor: (
			state,
			action: PayloadAction<AppState['opfsMountDescriptor']>
		) => {
			state.opfsMountDescriptor = action.payload;
		},
	},
});

// Export actions
export const { setActiveSiteSlug, setActiveModal, setOpfsMountDescriptor } =
	appSlice.actions;

// Redux thunk for adding a site
export function addSite(siteInfo: SiteInfo) {
	return async (dispatch: typeof store.dispatch) => {
		// TODO: Handle errors
		// TODO: Possibly reflect addition in progress
		await addSiteToStorage(siteInfo);
		dispatch(appSlice.actions.addSite(siteInfo));
	};
}

// Redux thunk for removing a site
export function removeSite(site: SiteInfo) {
	return async (dispatch: typeof store.dispatch) => {
		// TODO: Handle errors
		// TODO: Possibly reflect removal in progress
		await removeSiteFromStorage(site);
		dispatch(appSlice.actions.removeSite(site));
	};
}

export function selectSite(siteSlug: string) {
	return async (dispatch: typeof store.dispatch) => {
		const opfsRoot = await navigator.storage.getDirectory();
		const opfsDir = await opfsRoot.getDirectoryHandle(
			siteSlug === 'wordpress' ? siteSlug : 'site-' + siteSlug,
			{
				create: true,
			}
		);
		dispatch(setActiveSiteSlug(siteSlug));
		dispatch(
			setOpfsMountDescriptor({
				device: {
					type: 'opfs',
					path: await directoryHandleToOpfsPath(opfsDir),
				},
				mountpoint: '/wordpress',
			})
		);
	};
}

// Configure store
const rootReducer = combineSlices(playgroundSlice, appSlice);
const store = configureStore({
	reducer: rootReducer,
	middleware: (getDefaultMiddleware) =>
		getDefaultMiddleware({
			serializableCheck: {
				// Ignore these action types
				ignoredActions: [
					'setOpfsMountDescriptor',
					'app/startPlayground',
				],
				// Ignore these field paths in all actions
				ignoredActionPaths: [
					// OPFS
					'payload.handle',
					// Playground clients, sites
					'meta.arg.iframe',
					'payload.changes.client',
				],
				// Ignore these paths in the state
				ignoredPaths: [
					'opfsMountDescriptor.handle',
					'clients.entities',
				],
			},
		}),
});

export const useAppDispatch = () => useDispatch<typeof store.dispatch>();

function setupOnlineOfflineListeners(dispatch: PlaygroundDispatch) {
	window.addEventListener('online', () => {
		dispatch(appSlice.actions.setOfflineStatus(false));
	});
	window.addEventListener('offline', () => {
		dispatch(appSlice.actions.setOfflineStatus(true));
	});
}
setupOnlineOfflineListeners(store.dispatch);

// NOTE: We will likely want to configure and list sites someplace else,
// but for now, it seems fine to just kick off loading from OPFS
// after the store is created.
listSites().then(
	(sites) => store.dispatch(appSlice.actions.setSiteListingLoaded(sites)),
	(error) =>
		store.dispatch(
			appSlice.actions.setSiteListingError(
				error instanceof Error ? error.message : 'Unknown error'
			)
		)
);

// Define RootState type
export type PlaygroundReduxState = ReturnType<typeof store.getState>;

// Define AppDispatch type
export type PlaygroundDispatch = typeof store.dispatch;

export default store;
