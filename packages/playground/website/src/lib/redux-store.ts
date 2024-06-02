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
}

const query = new URL(document.location.href).searchParams;

// Define the initial state
const initialState: AppState = {
	activeModal:
		query.get('modal') === 'mount-markdown-directory'
			? 'mount-markdown-directory'
			: null,
};

if (query.get('storage') === 'browser') {
	const siteSlug = query.get('site-slug') || 'wordpress';
	const opfsRoot = await navigator.storage.getDirectory();
	const opfsDir = await opfsRoot.getDirectoryHandle(
		siteSlug === 'wordpress' ? siteSlug : 'site-' + siteSlug,
		{
			create: true,
		}
	);
	directoryHandleResolve({
		handle: opfsDir,
		mountpoint: '/wordpress',
	});
} else if (initialState.activeModal !== 'mount-markdown-directory') {
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
	},
});

// Export actions
export const { setActiveModal } = slice.actions;

// Configure store
const store = configureStore({
	reducer: slice.reducer,
});

// Define RootState type
export type PlaygroundReduxState = ReturnType<typeof store.getState>;

// Define AppDispatch type
export type PlaygroundDispatch = typeof store.dispatch;

export default store;
