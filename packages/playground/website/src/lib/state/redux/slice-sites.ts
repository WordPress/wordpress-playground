import {
	createSlice,
	createEntityAdapter,
	PayloadAction,
} from '@reduxjs/toolkit';
import { SiteMetadata } from '../../site-metadata';
import { PlaygroundDispatch, PlaygroundReduxState } from './store';
import { opfsSiteStorage } from '../opfs/opfs-site-storage';

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

// Define the loading state type
export type LoadingState = 'loading' | 'loaded' | 'error';

// Create an entity adapter for SiteInfo
const sitesAdapter = createEntityAdapter<SiteInfo, string>({
	selectId: (site) => site.slug,
	sortComparer: (a, b) => a.slug.localeCompare(b.slug),
});

// Define the initial state using the adapter and include the loading state
const initialState = sitesAdapter.getInitialState({
	loadingState: 'loading' as LoadingState,
});

// Create the slice
const sitesSlice = createSlice({
	name: 'sites',
	initialState,
	reducers: {
		// Add one or many sites
		addSites: sitesAdapter.addMany,
		addSite: sitesAdapter.addOne,
		updateSite: sitesAdapter.updateOne,
		removeSite: sitesAdapter.removeOne,

		// Custom reducer for updating nested properties
		updateSiteMetadata: (
			state,
			action: PayloadAction<{
				slug: string;
				metadata: Partial<SiteMetadata>;
			}>
		) => {
			const { slug, metadata } = action.payload;
			const site = state.entities[slug];
			if (site) {
				site.metadata = { ...site.metadata, ...metadata };
			}
		},

		setSites: sitesAdapter.setAll,

		// New reducers for managing loading state
		setLoadingState: (state, action: PayloadAction<LoadingState>) => {
			state.loadingState = action.payload;
		},
	},
});

export function generateUniqueSiteName(defaultName: string, sites: SiteInfo[]) {
	const baseName = defaultName;
	let suffix = 1;
	let uniqueName = baseName;
	// eslint-disable-next-line no-loop-func
	while (sites.some((site) => site.metadata.name === uniqueName)) {
		uniqueName = `${baseName} ${suffix++}`;
	}
	return uniqueName;
}

export const siteListingLoaded = (sites: SiteInfo[]) => {
	return (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		const currentSites = getState().sites.entities;
		const allSites = { ...currentSites };
		sites.forEach((site) => {
			allSites[site.slug] = site;
		});
		dispatch(sitesSlice.actions.setSites(allSites));
		dispatch(setLoadingState('loaded'));
	};
};

// New selector for loading state
export const getSitesLoadingState = (state: {
	sites: ReturnType<typeof sitesSlice.reducer>;
}) => state.sites.loadingState;

export function deriveSlugFromSiteName(name: string) {
	return name.toLowerCase().replaceAll(' ', '-');
}

/**
 * Updates the site metadata in the OPFS and in the redux state.
 */
export function updateSiteMetadata({
	slug,
	changes,
}: {
	slug: string;
	changes: Omit<Partial<SiteMetadata>, 'storage'>;
}) {
	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		const storedSite = selectSiteBySlug(getState(), slug);
		dispatch(
			updateSite({
				slug,
				changes: {
					metadata: {
						...storedSite.metadata,
						...changes,
					},
				},
			})
		);
	};
}
/**
 * Updates a site in the OPFS and in the redux state.
 *
 * @param siteInfo The site info to update.
 * @returns
 */
export function updateSite({
	slug,
	changes,
}: {
	slug: string;
	changes: Partial<SiteInfo>;
}) {
	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		dispatch(
			sitesSlice.actions.updateSite({
				id: slug,
				changes,
			})
		);
		const updatedSite = selectSiteBySlug(getState(), slug);
		if (updatedSite.metadata.storage === 'opfs') {
			await opfsSiteStorage?.update(
				updatedSite.slug,
				updatedSite.metadata
			);
		}
	};
}

/**
 * Creates a new site in the OPFS and in the redux state.
 *
 * @param siteInfo The site info to add.
 * @returns
 */
export function addSite(siteInfo: SiteInfo) {
	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		if (siteInfo.metadata.storage === 'opfs') {
			await opfsSiteStorage?.create(siteInfo.slug, siteInfo.metadata);
		}
		dispatch(sitesSlice.actions.addSite(siteInfo));
	};
}

/**
 * Removes a site from the OPFS and from the redux state.
 *
 * @param siteInfo The site info to remove.
 * @returns
 */
export function removeSite(siteInfo: SiteInfo) {
	return async (dispatch: PlaygroundDispatch) => {
		if (siteInfo.metadata.storage === 'opfs') {
			await opfsSiteStorage?.delete(siteInfo.slug);
		}
		dispatch(sitesSlice.actions.removeSite(siteInfo.slug));
	};
}

export const { setLoadingState } = sitesSlice.actions;

export const {
	selectAll: selectAllSites,
	selectById: selectSiteBySlug,
	selectIds: selectSiteSlugs,
} = sitesAdapter.getSelectors(
	(state: { sites: ReturnType<typeof sitesSlice.reducer> }) => state.sites
);

export default sitesSlice.reducer;
