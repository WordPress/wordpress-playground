import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ActiveModal =
	| 'error-report'
	| 'log'
	| 'start-error'
	| 'mount-markdown-directory'
	| false;

// Define the state types
interface AppState {
	directoryHandle: FileSystemDirectoryHandle | null;
	activeModal: string | null;
}

const query = new URL(document.location.href).searchParams;

// Define the initial state
const initialState: AppState = {
	directoryHandle: null,
	activeModal:
		query.get('modal') === 'mount-markdown-directory'
			? 'mount-markdown-directory'
			: null,
};

// Create the slice
const slice = createSlice({
	name: 'app',
	initialState,
	reducers: {
		setDirectoryHandle: (
			state,
			action: PayloadAction<FileSystemDirectoryHandle | null>
		) => {
			state.directoryHandle = action.payload;
		},
		setActiveModal: (state, action: PayloadAction<string | null>) => {
			state.activeModal = action.payload;
		},
		clearActiveModal: (state) => {
			state.activeModal = null;
		},
	},
});

// Export actions
export const { setDirectoryHandle, setActiveModal, clearActiveModal } =
	slice.actions;

// Configure store
const store = configureStore({
	reducer: slice.reducer,
});

// Define RootState type
export type PlaygroundReduxState = ReturnType<typeof store.getState>;

// Define AppDispatch type
export type PlaygroundDispatch = typeof store.dispatch;

export default store;
