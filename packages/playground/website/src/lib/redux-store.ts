import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
	directoryHandleResolve,
	directoryHandleDone,
} from './markdown-directory-handle';
import {
	type SiteInfo,
	listSites,
	addSite as addSiteToStorage,
	removeSite as removeSiteFromStorage,
} from './site-storage';

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

// Define the state types
interface AppState {
	activeModal: string | null;
	offline: boolean;
	siteListing: SiteListing;
}

const query = new URL(document.location.href).searchParams;

// Define the initial state
const initialState: AppState = {
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

if (initialState.activeModal !== 'mount-markdown-directory') {
	directoryHandleResolve(null);
}

// Create the slice
const slice = createSlice({
	name: 'app',
	initialState,
	reducers: {
		setActiveModal: (state, action: PayloadAction<string | null>) => {
			if (
				!directoryHandleDone &&
				state.activeModal === 'mount-markdown-directory' &&
				action.payload !== 'mount-markdown-directory'
			) {
				directoryHandleResolve(null);
			}
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
	},
});

// Export actions
export const { setActiveModal } = slice.actions;

// Redux thunk for adding a site
export function addSite(siteInfo: SiteInfo) {
	return async (dispatch: typeof store.dispatch) => {
		// TODO: Handle errors
		// TODO: Possibly reflect addition in progress
		await addSiteToStorage(siteInfo);
		dispatch(slice.actions.addSite(siteInfo));
	};
}

// Redux thunk for removing a site
export function removeSite(site: SiteInfo) {
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

// Define RootState type
export type PlaygroundReduxState = ReturnType<typeof store.getState>;

// Define AppDispatch type
export type PlaygroundDispatch = typeof store.dispatch;

export default store;
