import { createSlice, PayloadAction, Middleware } from '@reduxjs/toolkit';

export interface UIState {
	activeSiteSlug?: string;
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
			state.activeSiteSlug = action.payload;
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

export const { setActiveSite, setActiveModal, setOffline, setSiteManagerOpen } =
	uiSlice.actions;

export default uiSlice.reducer;
