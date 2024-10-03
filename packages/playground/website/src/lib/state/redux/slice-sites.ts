import {
	createSlice,
	createEntityAdapter,
	PayloadAction,
	createSelector,
} from '@reduxjs/toolkit';
import { SiteMetadata } from '../../site-metadata';
import {
	selectActiveSite,
	PlaygroundDispatch,
	PlaygroundReduxState,
	setActiveSite,
} from './store';
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

export function archiveAllTemporarySites() {
	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		const temporarySites = selectTemporarySites(getState());
		for (const site of temporarySites) {
			await dispatch(
				updateSiteMetadata({
					slug: site.slug,
					changes: {
						isArchived: true,
					},
				})
			);
		}
	};
}

export function deleteDormantArchivedSites() {
	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		const archivedSites = selectArchivedSites(getState());
		for (const site of archivedSites) {
			if (isDormantArchivedSite(site)) {
				await dispatch(removeSite(site.slug));
			}
		}
	};
}

const DAY_IN_MS = 1000 * 60 * 60 * 24;
function isDormantArchivedSite(site: SiteInfo) {
	const { metadata } = site;
	return (
		metadata.isArchived &&
		(metadata.whenLastLoaded === undefined ||
			metadata.whenLastLoaded < Date.now() - DAY_IN_MS)
	);
}

/**
 * Updates the site metadata in the OPFS and in the redux state.
 */
export function updateSiteMetadata({
	slug,
	changes,
}: {
	slug: string;
	changes: Partial<SiteMetadata>;
}) {
	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		const storedSite = selectSiteBySlug(getState(), slug);
		await dispatch(
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

export function restoreSite(slug: string) {
	return async (dispatch: PlaygroundDispatch) => {
		dispatch(
			updateSiteMetadata({
				slug,
				changes: {
					isArchived: false,
					// Reset the created date to now to prevent that site from getting immediately
					// archived and removed.
					whenCreated: new Date().getTime(),
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
		await opfsSiteStorage?.update(updatedSite.slug, updatedSite.metadata);
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
		await opfsSiteStorage?.create(siteInfo.slug, siteInfo.metadata);
		dispatch(sitesSlice.actions.addSite(siteInfo));
	};
}

/**
 * Removes a site from the OPFS and from the redux state.
 *
 * @param siteInfo The site info to remove.
 * @returns
 */
export function removeSite(slug: string) {
	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		const activeSite = selectActiveSite(getState());
		const siteInfo = selectSiteBySlug(getState(), slug);
		await opfsSiteStorage?.delete(siteInfo.slug);
		dispatch(sitesSlice.actions.removeSite(siteInfo.slug));

		// Select the most recently created site
		if (activeSite?.slug === siteInfo.slug) {
			const newActiveSite = selectUnarchivedSites(getState())[0];
			if (newActiveSite) {
				dispatch(setActiveSite(newActiveSite.slug));
			}
		}
	};
}

export const { setLoadingState } = sitesSlice.actions;

export const {
	selectAll: selectAllSitesRaw,
	selectById: selectSiteBySlug,
	selectIds: selectSiteSlugs,
} = sitesAdapter.getSelectors(
	(state: { sites: ReturnType<typeof sitesSlice.reducer> }) => state.sites
);

export const selectAllSites = createSelector(
	[selectAllSitesRaw],
	(sites: SiteInfo[]) =>
		sites.sort(
			(a, b) =>
				(b.metadata.whenCreated || 0) - (a.metadata.whenCreated || 0)
		)
);

export const selectUnarchivedSites = createSelector(
	[selectAllSites],
	(sites: SiteInfo[]) => sites.filter((site) => !site.metadata.isArchived)
);

export const selectUnarchivedSiteBySlug = createSelector(
	[selectUnarchivedSites, (_state: any, slug: string) => slug],
	(sites: SiteInfo[], slug: string) =>
		sites.find((site) => site.slug === slug)
);

export const selectArchivedSites = createSelector(
	[selectAllSites],
	(sites: SiteInfo[]) => sites.filter((site) => site.metadata.isArchived)
);

export const selectTemporarySites = createSelector(
	[selectAllSites],
	(sites: SiteInfo[]) => {
		return sites.filter(
			(site) => site.metadata.storage === 'opfs-temporary'
		);
	}
);

export default sitesSlice.reducer;
