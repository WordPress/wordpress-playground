import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice, createEntityAdapter } from '@reduxjs/toolkit';
import type { SyncProgress } from '@php-wasm/web';
import type { MountDevice } from '@wp-playground/storage';
import type { PlaygroundClient } from '@wp-playground/remote';
import type { Email } from 'postal-mime';

export type OpfsSync =
	| {
			status: 'syncing';
			progress?: SyncProgress;
			operation?: 'save' | 'autosave';
	  }
	| {
			status: 'error';
			operation?: 'save' | 'autosave';
	  };

export interface ClientInfo {
	client: PlaygroundClient;
	siteSlug: string;
	url: string;
	emails: Email[];
	opfsMountDescriptor?: {
		device: MountDevice;
		mountpoint: string;
	};
	opfsSync?: OpfsSync;
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
		addClientInfo: clientsAdapter.addOne,
		updateClientInfo: (
			state,
			action: PayloadAction<{
				siteSlug: string;
				changes: Partial<ClientInfo>;
			}>
		) => {
			clientsAdapter.updateOne(state, {
				id: action.payload.siteSlug,
				changes: action.payload.changes,
			});
		},
		addClientEmail: (
			state,
			action: PayloadAction<{
				siteSlug: string;
				email: Email;
			}>
		) => {
			state.entities[action.payload.siteSlug]?.emails.unshift(
				action.payload.email
			);
		},
		removeClientInfo: clientsAdapter.removeOne,
	},
});

// Export actions
export const {
	addClientInfo,
	updateClientInfo,
	addClientEmail,
	removeClientInfo,
} = clientsSlice.actions;

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
