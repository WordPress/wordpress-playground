import {
	createSlice,
	createEntityAdapter,
	PayloadAction,
} from '@reduxjs/toolkit';
import { MountDevice, SyncProgress } from '@php-wasm/web';
import { PlaygroundClient } from '@wp-playground/remote';

export interface ClientInfo {
	client: PlaygroundClient;
	siteSlug: string;
	url: string;
	opfsMountDescriptor?: {
		device: MountDevice;
		mountpoint: string;
	};
	opfsIsSyncing?: boolean;
	opfsSyncProgress?: SyncProgress;
}

// Create an entity adapter for ClientInfo
const clientsAdapter = createEntityAdapter<ClientInfo, string>({
	selectId: (clientInfo) => clientInfo.siteSlug,
	sortComparer: (a, b) => a.siteSlug.localeCompare(b.siteSlug),
});

// Define the initial state using the adapter
const initialState = clientsAdapter.getInitialState();

// Create the slice
const clientsSlice = createSlice({
	name: 'clients',
	initialState,
	reducers: {
		// addClientInfo: (state, action: PayloadAction<ClientInfo>) => {
		// 	return clientsAdapter.addOne(state, action.payload);
		// },
		// updateClientInfo: (state, action: PayloadAction<ClientInfo>) => {
		// 	return clientsAdapter.updateOne(state, {
		// 		id: action.payload.siteSlug,
		// 		changes: action.payload,
		// 	});
		// },
		addClientInfo: clientsAdapter.addOne,
		updateClientInfo: (
			state,
			action: PayloadAction<{
				siteSlug: string;
				changes: Partial<ClientInfo>;
			}>
		) => {
			state.entities[action.payload.siteSlug] = {
				...state.entities[action.payload.siteSlug],
				...action.payload.changes,
			};
		},
		removeClientInfo: clientsAdapter.removeOne,
	},
});

// Export actions
export const { addClientInfo, updateClientInfo, removeClientInfo } =
	clientsSlice.actions;

export default clientsSlice.reducer;

// Export selectors
export const {
	selectAll: selectAllClientInfo,
	selectById: selectClientInfoBySiteSlug,
	selectIds: selectClientInfoSiteSlugs,
} = clientsAdapter.getSelectors(
	(state: { clients: ReturnType<typeof clientsSlice.reducer> }) =>
		state.clients
);

export function selectClientBySiteSlug(
	state: { clients: ReturnType<typeof clientsSlice.reducer> },
	siteSlug: string
) {
	return selectClientInfoBySiteSlug(state, siteSlug)?.client;
}
