import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { getDirectoryNameForSlug, siteStorage } from './site-storage';
import type { MountDevice, SyncProgress } from '@php-wasm/web';
import {
	Blueprint,
	compileBlueprint,
	MountDescriptor,
	PlaygroundClient,
} from '@wp-playground/client';
import { useDispatch, useSelector } from 'react-redux';
import { updateUrl } from './router-hooks';
import { logger } from '@php-wasm/logger';
import { saveDirectoryHandle } from './idb-opfs';
import { resolveBlueprint } from './resolve-blueprint';
import { SiteMetadata } from './site-metadata';

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

/**
 * The Site model used to represent a site within Playground.
 */
export interface SiteInfo {
	slug: string;
	originalUrlParams?: {
		searchParams?: Record<string, string>;
		hash?: string;
	};
	metadata: SiteMetadata;
}

/**
 * The initial information used to create a new site.
 */
export type InitialSiteInfo = Omit<SiteInfo, 'id' | 'slug' | 'whenCreated'>;

export type SiteListing = {
	status: SiteListingStatus;
	sites: SiteInfo[];
};

export interface ClientInfo {
	client: PlaygroundClient;
	url: string;
	opfsMountDescriptor?: {
		device: MountDevice;
		mountpoint: string;
	};
	opfsIsSyncing?: boolean;
	opfsSyncProgress?: SyncProgress;
}

// Define the state types
interface AppState {
	activeSiteSlug?: string;
	activeModal: string | null;
	offline: boolean;
	siteListing: SiteListing;
	clients: Record<string, ClientInfo>;
	siteManagerIsOpen: boolean;
}

const query = new URL(document.location.href).searchParams;
const isEmbeddedInAnIframe = window.self !== window.top;

// Define the initial state
const initialState: AppState = {
	activeModal:
		query.get('modal') === 'mount-markdown-directory'
			? 'mount-markdown-directory'
			: null,
	offline: !navigator.onLine,
	clients: {},
	siteListing: {
		status: { type: 'loading' },
		sites: [],
	},
	// Open site manager for direct playground.wordpress.net visitors,
	// unless they specifically request seamless mode.
	siteManagerIsOpen:
		query.get('mode') !== 'seamless' && !isEmbeddedInAnIframe,
};

// Create the slice
const slice = createSlice({
	name: 'app',
	initialState,
	reducers: {
		setActiveSite: (state, action: PayloadAction<string>) => {
			state.activeSiteSlug = action.payload;
		},
		forgetClientInfo: (state, action: PayloadAction<string>) => {
			delete state.clients[action.payload];
		},
		updateClientInfo: (
			state,
			action: PayloadAction<{
				siteSlug: string;
				info: Partial<ClientInfo>;
			}>
		) => {
			const siteSlug = action.payload.siteSlug;
			if (!state.clients[siteSlug]) {
				state.clients[siteSlug] = {
					url: '/',
				} as ClientInfo;
			}
			state.clients[siteSlug] = {
				...state.clients[siteSlug],
				...action.payload.info,
			};
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
				sites: [...action.payload, ...state.siteListing.sites],
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
		updateSite: (
			state,
			action: PayloadAction<Partial<SiteInfo> & { slug: string }>
		) => {
			const siteIndex = state.siteListing.sites.findIndex(
				(siteInfo) => siteInfo.slug === action.payload.slug
			);
			const site = state.siteListing.sites[siteIndex];
			if (!site) {
				// @TODO: Handle errors?
				return;
			}
			state.siteListing.sites[siteIndex] = recursiveMerge(
				site,
				action.payload
			);
		},
		addSite: (state, action: PayloadAction<SiteInfo>) => {
			state.siteListing.sites.push(action.payload);
		},
		removeSite: (state, action: PayloadAction<SiteInfo>) => {
			const idToRemove = action.payload.metadata.id;
			const siteIndex = state.siteListing.sites.findIndex(
				(siteInfo) => siteInfo.metadata.id === idToRemove
			);
			if (siteIndex !== undefined) {
				state.siteListing.sites.splice(siteIndex, 1);
			}
		},
		setSiteManagerIsOpen: (state, action: PayloadAction<boolean>) => {
			state.siteManagerIsOpen = action.payload;
		},
	},
});

function recursiveMerge<T extends Record<string, any>>(
	original: T,
	updated: Partial<T>
): T {
	for (const [key, value] of Object.entries(updated)) {
		if (typeof value === 'object' && value !== null) {
			(original as any)[key] = recursiveMerge(original[key] || {}, value);
		} else if (value === undefined) {
			delete (original as any)[key];
		} else {
			(original as any)[key] = value;
		}
	}
	return original;
}

// Export actions
export const {
	setActiveModal,
	updateClientInfo,
	forgetClientInfo,
	setActiveSite,
	setSiteManagerIsOpen,
} = slice.actions;

export const getActiveClient = (
	state: PlaygroundReduxState
): ClientInfo | undefined =>
	state.activeSiteSlug ? state.clients[state.activeSiteSlug] : undefined;

export const getActiveSite = (
	state: PlaygroundReduxState
): SiteInfo | undefined =>
	state.activeSiteSlug
		? state.siteListing.sites.find(
				(site) => site.slug === state.activeSiteSlug
		  )
		: undefined;

export const useActiveSite = () => useAppSelector(getActiveSite);

// Redux thunk
export function updateSiteMetadata(siteInfo: SiteInfo) {
	return async (dispatch: typeof store.dispatch) => {
		// @TODO: Handle errors.
		// @TODO: Throw if storage type changed. This thunk is not for moving sites between
		//        storage backends.

		dispatch(slice.actions.updateSite(siteInfo));
		await siteStorage?.update(siteInfo.slug, siteInfo.metadata);
	};
}

export function saveSiteToDevice(
	siteSlug: string,
	deviceType: 'opfs' | 'local-fs'
) {
	return async (
		dispatch: typeof store.dispatch,
		getState: () => PlaygroundReduxState
	) => {
		// @TODO: Handle errors

		const state = getState();
		const playground = state.clients[siteSlug].client;
		if (!playground) {
			throw new Error(
				`Site ${siteSlug} must have an active client to be saved, but none was found.`
			);
		}

		const siteInfo = getSiteInfo(state, siteSlug)!;
		if (!siteInfo) {
			throw new Error(`Cannot find site ${siteSlug} to save.`);
		}
		await siteStorage?.create(siteInfo.slug, {
			...siteInfo.metadata,
			storage: deviceType,
		});

		let mountDescriptor: Omit<MountDescriptor, 'initialSyncDirection'>;
		if (deviceType === 'opfs') {
			mountDescriptor = {
				device: {
					type: 'opfs',
					path: '/' + getDirectoryNameForSlug(siteSlug),
				},
				mountpoint: '/wordpress',
			} as const;
		} else if (deviceType === 'local-fs') {
			let dirHandle: FileSystemDirectoryHandle;
			try {
				// Request permission to access the directory.
				// https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker
				dirHandle = await (window as any).showDirectoryPicker({
					// By specifying an ID, the browser can remember different directories
					// for different IDs.If the same ID is used for another picker, the
					// picker opens in the same directory.
					id: 'playground-directory',
					mode: 'readwrite',
				});
			} catch (e) {
				// No directory selected but log the error just in case.
				logger.error(e);
				return;
			}
			await saveDirectoryHandle(siteSlug, dirHandle);

			mountDescriptor = {
				device: {
					type: 'local-fs',
					handle: dirHandle,
				},
				mountpoint: '/wordpress',
			} as const;
		} else {
			throw new Error(`Unsupported device type: ${deviceType}`);
		}

		dispatch(
			updateClientInfo({
				siteSlug: siteSlug,
				info: {
					opfsMountDescriptor: mountDescriptor,
					opfsIsSyncing: true,
				},
			})
		);
		try {
			await playground!.mountOpfs(
				{
					...mountDescriptor,
					initialSyncDirection: 'memfs-to-opfs',
				},
				(progress) => {
					dispatch(
						updateClientInfo({
							siteSlug: siteSlug,
							info: {
								opfsSyncProgress: progress,
							},
						})
					);
				}
			);
		} finally {
			// @TODO: Tell the user the operation is complete
			dispatch(
				updateClientInfo({
					siteSlug: siteSlug,
					info: {
						opfsIsSyncing: false,
						opfsSyncProgress: undefined,
					},
				})
			);
		}

		dispatch(
			slice.actions.updateSite({
				slug: siteSlug,
				originalUrlParams: undefined,
				metadata: {
					...siteInfo.metadata,
					storage: deviceType,
				},
			})
		);

		window.history.pushState(
			{},
			'',
			updateUrl(window.location.href, {
				searchParams: {
					'site-slug': siteSlug,
				},
			})
		);
	};
}

export function getSiteInfo(
	state: PlaygroundReduxState,
	siteSlug: string
): SiteInfo | undefined {
	return state.siteListing.sites.find((site) => site.slug === siteSlug);
}

// Redux thunk
export function createSite(siteInfo: SiteInfo) {
	return async (dispatch: typeof store.dispatch) => {
		// TODO: Handle errors
		// TODO: Possibly reflect addition in progress
		if (siteInfo.metadata.storage === 'opfs') {
			await siteStorage?.create(siteInfo.slug, siteInfo.metadata);
		}
		dispatch(slice.actions.addSite(siteInfo));
	};
}

// Redux thunk
export function deleteSite(siteInfo: SiteInfo) {
	return async (dispatch: typeof store.dispatch) => {
		// TODO: Handle errors
		// TODO: Possibly reflect removal in progress
		if (siteInfo.metadata.storage === 'opfs') {
			await siteStorage?.delete(siteInfo.slug);
		}
		dispatch(slice.actions.removeSite(siteInfo));
	};
}

// Configure store
const store = configureStore({
	reducer: slice.reducer,
	middleware: (getDefaultMiddleware) =>
		getDefaultMiddleware({
			serializableCheck: {
				// Ignore these action types
				ignoredActions: [
					'setOpfsMountDescriptor',
					'app/setPlaygroundClient',
					'app/setActiveSite',
					'app/updateClientInfo',
				],
				// Ignore these field paths in all actions
				ignoredActionPaths: [
					'payload.handle',
					'payload.info.client',
					'payload.info.opfsMountDescriptor.device.handle',
				],
				// Ignore these paths in the state
				ignoredPaths: ['opfsMountDescriptor.handle', 'clients'],
			},
		}),
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
siteStorage?.list().then(
	(sites) => store.dispatch(slice.actions.setSiteListingLoaded(sites)),
	(error) =>
		store.dispatch(
			slice.actions.setSiteListingError(
				error instanceof Error ? error.message : 'Unknown error'
			)
		)
);

/**
 * Generates a random, human readable site name.
 * For example: "Abandoned Road", "Old School", "Greenwich Village" etc.
 */
export function randomSiteName() {
	const adjectives = [
		'Happy',
		'Sad',
		'Excited',
		'Calm',
		'Brave',
		'Shy',
		'Clever',
		'Funny',
		'Kind',
		'Honest',
		'Loyal',
		'Patient',
		'Creative',
		'Energetic',
		'Ambitious',
		'Generous',
		'Humble',
		'Confident',
		'Curious',
		'Determined',
	];
	const differentAdjectives = [
		'Abandoned',
		'Old',
		'Sunny',
		'Quiet',
		'Busy',
		'Noisy',
		'Peaceful',
		'Cozy',
		'Modern',
		'Vintage',
		'Classic',
		'Trendy',
		'Hip',
		'Chic',
		'Glamorous',
	];
	const nouns = [
		'Road',
		'School',
		'Village',
		'Town',
		'City',
		'State',
		'Country',
		'Garden',
		'Park',
		'Forest',
		'Mountain',
		'Lake',
		'Ocean',
		'River',
		'Valley',
	];
	return [
		adjectives[Math.floor(Math.random() * adjectives.length)],
		differentAdjectives[
			Math.floor(Math.random() * differentAdjectives.length)
		],
		nouns[Math.floor(Math.random() * nouns.length)],
	].join(' ');
}

/**
 * @TODO: Do not generate unique site names. As a user I want the ability to have duplicates.
 */
export function generateUniqueSiteName(defaultName: string, sites: SiteInfo[]) {
	const numberOfSitesStartingWithDefaultName = sites.filter((site) =>
		site.metadata.name.startsWith(defaultName)
	).length;
	if (numberOfSitesStartingWithDefaultName === 0) {
		return defaultName;
	}
	return `${defaultName} ${numberOfSitesStartingWithDefaultName}`;
}

/**
 * Create a new site info structure from initial configuration.
 *
 * @param initialInfo The starting configuration for the site.
 * @returns SiteInfo The new site info structure.
 */
export async function createNewSiteInfo(
	initialInfo: Partial<Omit<InitialSiteInfo, 'metadata'>> & {
		metadata?: Partial<Omit<SiteMetadata, 'runtimeConfiguration'>>;
	}
): Promise<SiteInfo> {
	const {
		name: providedName,
		originalBlueprint,
		...remainingMetadata
	} = initialInfo.metadata || {};

	const name = providedName || randomSiteName();
	const blueprint: Blueprint =
		originalBlueprint ?? (await resolveBlueprint(new URL('https://w.org')));

	const compiledBlueprint = compileBlueprint(blueprint);

	return {
		slug: deriveSlugFromSiteName(name),

		...initialInfo,

		metadata: {
			name,
			id: crypto.randomUUID(),
			whenCreated: Date.now(),
			storage: 'none',
			originalBlueprint: blueprint,

			...remainingMetadata,

			runtimeConfiguration: {
				preferredVersions: {
					wp: compiledBlueprint.versions.wp,
					php: compiledBlueprint.versions.php,
				},
				phpExtensionBundles: blueprint.phpExtensionBundles || [
					'kitchen-sink',
				],
				features: compiledBlueprint.features,
				extraLibraries: compiledBlueprint.extraLibraries,
			},
		},
	};
}

function deriveSlugFromSiteName(name: string) {
	return name.toLowerCase().replaceAll(' ', '-');
}

export function useAppSelector<T>(
	selector: (state: PlaygroundReduxState) => T
): T {
	return useSelector(selector);
}

export function useAppDispatch() {
	return useDispatch<PlaygroundDispatch>();
}

// Define RootState type
export type PlaygroundReduxState = ReturnType<typeof store.getState>;

// Define AppDispatch type
export type PlaygroundDispatch = typeof store.dispatch;

export default store;
