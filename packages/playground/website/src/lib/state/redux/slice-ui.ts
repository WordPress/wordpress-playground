import { createSlice, PayloadAction, Middleware } from '@reduxjs/toolkit';

export type SiteError =
	| 'directory-handle-not-found-in-indexeddb'
	| 'directory-handle-permission-denied'
	| 'directory-handle-directory-does-not-exist'
	| 'directory-handle-unknown-error'
	// @TODO: Improve name?
	| 'site-boot-failed';

export interface UIState {
	activeSite?: {
		slug: string;
		error?: SiteError;
	};
	activeModal: string | null;
	offline: boolean;
	siteManagerIsOpen: boolean;
}

const query = new URL(document.location.href).searchParams;
const isEmbeddedInAnIframe = window.self !== window.top;

const initialState: UIState = {
	activeModal:
		query.get('modal') === 'mount-markdown-directory'
			? 'mount-markdown-directory'
			: null,
	offline: !navigator.onLine,
	// Open site manager for direct playground.wordpress.net visitors,
	// unless they specifically request seamless mode.
	siteManagerIsOpen:
		query.get('mode') !== 'seamless' && !isEmbeddedInAnIframe,
};

const uiSlice = createSlice({
	name: 'ui',
	initialState,
	reducers: {
		setActiveSite: (state, action: PayloadAction<string | undefined>) => {
			state.activeSite = action.payload
				? {
						slug: action.payload,
				  }
				: undefined;
		},
		setActiveSiteError: (state, action: PayloadAction<SiteError>) => {
			if (state.activeSite) {
				state.activeSite.error = action.payload;
			}
		},
		setActiveModal: (state, action: PayloadAction<string | null>) => {
			state.activeModal = action.payload;
		},
		setOffline: (state, action: PayloadAction<boolean>) => {
			state.offline = action.payload;
		},
		setSiteManagerOpen: (state, action: PayloadAction<boolean>) => {
			state.siteManagerIsOpen = action.payload;
		},
	},
});

export const __internal_uiSlice = uiSlice;

export const listenToOnlineOfflineEventsMiddleware: Middleware =
	(store) => (next) => (action) => {
		if (typeof window !== 'undefined') {
			window.addEventListener('online', () => {
				store.dispatch(uiSlice.actions.setOffline(false));
			});
			window.addEventListener('offline', () => {
				store.dispatch(uiSlice.actions.setOffline(true));
			});
		}
		return next(action);
	};

export const {
	setActiveModal,
	setActiveSiteError,
	setOffline,
	setSiteManagerOpen,
} = uiSlice.actions;

export default uiSlice.reducer;
