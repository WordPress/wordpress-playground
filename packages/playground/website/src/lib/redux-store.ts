import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
	directoryHandleResolve,
	directoryHandleDone,
} from './markdown-directory-handle';

export type ActiveModal =
	| 'error-report'
	| 'log'
	| 'start-error'
	| 'mount-markdown-directory'
	| false;

// Define the state types
interface AppState {
	activeModal: string | null;
	offline: boolean;
}

const query = new URL(document.location.href).searchParams;

// Define the initial state
const initialState: AppState = {
	activeModal:
		query.get('modal') === 'mount-markdown-directory'
			? 'mount-markdown-directory'
			: null,
	offline: !navigator.onLine,
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
	},
});

// Export actions
export const { setActiveModal } = slice.actions;

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

// Define RootState type
export type PlaygroundReduxState = ReturnType<typeof store.getState>;

// Define AppDispatch type
export type PlaygroundDispatch = typeof store.dispatch;

export default store;
