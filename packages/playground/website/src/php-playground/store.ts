import {
	configureStore,
	createSlice,
	type PayloadAction,
} from '@reduxjs/toolkit';
import type { PlaygroundClient } from '@wp-playground/client';
import { SupportedPHPVersionsList } from '@wp-playground/client';

import { DEFAULT_CODE, DEFAULT_PHP_VERSION } from './constants';

export type BootStatus = 'idle' | 'booting' | 'ready' | 'error';

export interface PlaygroundState {
	code: string;
	currentPath: string | null;
	phpVersion: string;
	wpVersion: string;
	phpVersions: string[];
	wpVersions: string[];
	bootStatus: BootStatus;
	bootError: string | null;
	runRequestId: number;
	client: PlaygroundClient | null;
	initialized: boolean;
	wpVersionsLoading: boolean;
}

const initialState: PlaygroundState = {
	code: DEFAULT_CODE,
	currentPath: null,
	phpVersion: DEFAULT_PHP_VERSION,
	wpVersion: 'latest',
	phpVersions: SupportedPHPVersionsList,
	wpVersions: [],
	bootStatus: 'idle',
	bootError: null,
	runRequestId: 0,
	client: null,
	initialized: false,
	wpVersionsLoading: true,
};

const playgroundSlice = createSlice({
	name: 'playground',
	initialState,
	reducers: {
		setCode(state, action: PayloadAction<string>) {
			state.code = action.payload;
		},
		setCurrentPath(state, action: PayloadAction<string | null>) {
			state.currentPath = action.payload;
		},
		setPhpVersion(state, action: PayloadAction<string>) {
			state.phpVersion = action.payload;
		},
		setWpVersion(state, action: PayloadAction<string>) {
			state.wpVersion = action.payload;
		},
		setWpVersions(state, action: PayloadAction<string[]>) {
			state.wpVersions = action.payload;
			state.wpVersionsLoading = false;
		},
		setWpVersionsLoading(state, action: PayloadAction<boolean>) {
			state.wpVersionsLoading = action.payload;
		},
		queueRun(state) {
			state.runRequestId += 1;
		},
		setBootStatus(state, action: PayloadAction<BootStatus>) {
			state.bootStatus = action.payload;
			if (action.payload !== 'error') {
				state.bootError = null;
			}
		},
		setBootError(state, action: PayloadAction<string | null>) {
			state.bootError = action.payload;
		},
		setClient(state, action: PayloadAction<PlaygroundClient | null>) {
			state.client = action.payload;
		},
		applyUrlState(
			state,
			action: PayloadAction<{
				code: string;
				phpVersion?: string;
				wpVersion?: string;
			}>
		) {
			state.code = action.payload.code;
			if (action.payload.phpVersion) {
				state.phpVersion = action.payload.phpVersion;
			}
			if (action.payload.wpVersion) {
				state.wpVersion = action.payload.wpVersion;
			}
			state.initialized = true;
		},
	},
});

export const {
	setCode,
	setCurrentPath,
	setPhpVersion,
	setWpVersion,
	setWpVersions,
	setWpVersionsLoading,
	queueRun,
	setBootStatus,
	setBootError,
	setClient,
	applyUrlState,
} = playgroundSlice.actions;

export const store = configureStore({
	reducer: {
		playground: playgroundSlice.reducer,
	},
	middleware: (getDefaultMiddleware) =>
		getDefaultMiddleware({
			serializableCheck: false,
		}),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
