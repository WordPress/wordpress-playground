import type { PayloadAction } from '@reduxjs/toolkit';
import {
	createSlice,
	createEntityAdapter,
	createSelector,
} from '@reduxjs/toolkit';
import type { PlaygroundDispatch, PlaygroundReduxState } from './store';
import { selectActiveSite, setActiveSite } from './store';
import { opfsSiteStorage } from '../opfs/opfs-site-storage';
import {
	type BlueprintV1,
	BlueprintReflection,
	type RuntimeConfiguration,
	resolveRuntimeConfiguration,
	InvalidBlueprintError,
	BlueprintFetchError,
} from '@wp-playground/blueprints';
import {
	type BlueprintSource,
	resolveBlueprintFromURL,
	type ResolvedBlueprint,
	applyQueryOverrides,
} from '../url/resolve-blueprint-from-url';
import { logger } from '@php-wasm/logger';
import { setActiveSiteError, type SiteError } from './slice-ui';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { findFirewallErrorInCauseChain } from './error-utils';
import { deriveSlugFromSiteName, getUniqueSiteSlug } from './site-slug';
import {
	getAutosavedSitesToPrune,
	getSitesSortedByRecency,
	isAutosavedSite,
	type AutosavedSitesPruneOptions,
	type SitePersistence,
} from './site-lifecycle';
import { getAutosaveFingerprintFromURL } from '../playground-identity';
export {
	MAX_AUTOSAVED_SITES,
	SitePersistenceTypes,
	getAutosavedSitesToPrune,
	getSiteRecencyTimestamp,
	getSitesSortedByRecency,
	getSitePublicPersistence,
	isAutosavedSite,
	isExplicitlySavedSite,
	wasSiteRecentlyInteractedWith,
} from './site-lifecycle';
export type {
	AutosavedSitesPruneOptions,
	SitePersistence,
} from './site-lifecycle';

const DEFAULT_BLUEPRINT =
	'https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/welcome/blueprint.json';

/**
 * The Site model used to represent a site within Playground.
 */
export interface SiteInfo {
	slug: string;
	originalUrlParams?: {
		searchParams?: Record<string, string | string[]>;
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
	opfsSitesLoadingState: 'loading' as LoadingState,
	firstTemporarySiteCreated: false,
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
		setOPFSSitesLoadingState: (
			state,
			action: PayloadAction<LoadingState>
		) => {
			state.opfsSitesLoadingState = action.payload;
		},
		setFirstTemporarySiteCreated: (state) => {
			state.firstTemporarySiteCreated = true;
		},
	},
});

export const OPFSSitesLoaded = (sites: SiteInfo[]) => {
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
		dispatch(setOPFSSitesLoadingState('loaded'));
	};
};

// New selector for loading state
export const getSitesLoadingState = (state: {
	sites: ReturnType<typeof sitesSlice.reducer>;
}) => state.sites.opfsSitesLoadingState;

export function deriveSiteNameFromSlug(slug: string) {
	return slug
		.replaceAll('-', ' ')
		.replaceAll(/\b\w/g, (c) => c.toUpperCase())
		.replaceAll(/WordPress/gi, 'WordPress');
}

/**
 * Updates site metadata in redux and, for stored sites, in OPFS.
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
		if (!storedSite) {
			throw new Error(`Site not found: ${slug}`);
		}
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

/**
 * Marks a stored Playground as explicitly saved.
 *
 * This removes autosaved OPFS Playgrounds from autosave pruning. Temporary
 * Playgrounds must be saved before they can be preserved.
 */
export function preserveSite(slug: string) {
	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		const site = selectSiteBySlug(getState(), slug);
		if (!site) {
			throw new Error(`Site not found: ${slug}`);
		}
		if (site.metadata.storage === 'none') {
			throw new Error('Cannot preserve a temporary site. Save it first.');
		}
		await dispatch(
			updateSiteMetadata({
				slug,
				changes: {
					persistence: 'explicit',
				},
			})
		);
	};
}

/**
 * Updates a site in redux and, for stored sites, in OPFS.
 *
 * The storage backend cannot be changed through this helper.
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
		if ('storage' in changes) {
			throw new Error('Cannot update storage for a site.');
		}
		dispatch(
			sitesSlice.actions.updateSite({
				id: slug,
				changes,
			})
		);
		const updatedSite = selectSiteBySlug(getState(), slug);
		if (updatedSite.metadata.storage !== 'none') {
			await opfsSiteStorage?.update(
				updatedSite.slug,
				updatedSite.metadata
			);
		}
	};
}

/**
 * Creates a new stored site in OPFS and in the redux state.
 *
 * The OPFS metadata write must succeed before Redux is updated. Otherwise the
 * UI would list a saved Playground that cannot survive a reload.
 *
 * @param siteInfo The site info to add.
 */
export function addSite(siteInfo: SiteInfo) {
	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		if (siteInfo.metadata.storage === 'none') {
			throw new Error(
				'Cannot add a temporary site. Use setTemporarySiteSpec instead.'
			);
		}
		if (!opfsSiteStorage) {
			throw new Error(
				'Cannot add a saved Playground because browser storage is not available.'
			);
		}
		await opfsSiteStorage.create(siteInfo.slug, siteInfo.metadata);
		dispatch(sitesSlice.actions.addSite(siteInfo));
	};
}

/**
 * Removes a stored site from OPFS and from the redux state.
 *
 * Temporary sites are rejected because they only exist in redux state.
 */
export function removeSite(slug: string) {
	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		const activeSite = selectActiveSite(getState());
		const siteInfo = selectSiteBySlug(getState(), slug);
		if (siteInfo.metadata.storage === 'none') {
			throw new Error('Cannot remove a temporary site.');
		}
		try {
			await opfsSiteStorage?.delete(siteInfo.slug);
		} catch (error: any) {
			logger.error('Error deleting site from OPFS:', error);
		}
		dispatch(sitesSlice.actions.removeSite(siteInfo.slug));

		// Select the most recently created site
		if (activeSite?.slug === siteInfo.slug) {
			const newActiveSite = selectSortedSites(getState())[0];
			if (newActiveSite) {
				dispatch(setActiveSite(newActiveSite.slug));
			}
		}
	};
}

/**
 * Removes autosaved Playgrounds beyond the retention limit.
 *
 * Explicitly saved Playgrounds are never pruned. `excludeSlugs` protects
 * specific autosaves for the current prune pass.
 */
export function pruneAutosavedSites(options: AutosavedSitesPruneOptions = {}) {
	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		const sitesToPrune = getAutosavedSitesToPrune(
			selectAllSites(getState()),
			options
		);
		for (const site of sitesToPrune) {
			await dispatch(removeSite(site.slug));
		}
	};
}

/**
 * Creates or reuses a temporary Playground in the redux state.
 */
export function setTemporarySiteSpec(
	siteName: string,
	playgroundUrlWithQueryApiArgs: URL,
	preferredSlug?: string
) {
	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		const newSiteUrlParams = getOriginalUrlParams(
			playgroundUrlWithQueryApiArgs
		);

		const showTemporarySiteError = (params: {
			error: SiteError;
			details: unknown;
		}) => {
			// Create a mock temporary site to associate the error with.
			const errorSite: SiteInfo = {
				slug: siteSlug,
				originalUrlParams: newSiteUrlParams,
				metadata: {
					name: siteName,
					id: crypto.randomUUID(),
					whenCreated: Date.now(),
					storage: 'none' as const,
					sourceSetupUrlFingerprint: getAutosaveFingerprintFromURL(
						playgroundUrlWithQueryApiArgs
					),
					originalBlueprint: {},
					originalBlueprintSource: {
						type: 'none',
					},
					// Any default values are fine here.
					runtimeConfiguration: {
						phpVersion: RecommendedPHPVersion,
						wpVersion: 'latest',
						intl: false,
						networking: true,
						extraLibraries: [],
						constants: {},
					},
				},
			};

			if (resolvedBlueprint) {
				errorSite.metadata.originalBlueprint =
					resolvedBlueprint.blueprint;
				errorSite.metadata.originalBlueprintSource =
					resolvedBlueprint.source;
			} else if (params.details instanceof BlueprintFetchError) {
				errorSite.metadata.originalBlueprintSource = {
					type: 'remote-url',
					url: params.details.url,
				};
			}

			dispatch(sitesSlice.actions.addSite(errorSite));
			dispatch(sitesSlice.actions.setFirstTemporarySiteCreated());

			setTimeout(() => {
				dispatch(
					setActiveSiteError({
						error: params.error,
						details: params.details,
					})
				);
			}, 0);

			return errorSite;
		};

		const currentTemporarySite = selectTemporarySite(getState());
		if (currentTemporarySite) {
			// If the current temporary site is the same as the site we're setting,
			// then we don't need to create a new site.
			if (
				JSON.stringify(currentTemporarySite.originalUrlParams) ===
				JSON.stringify(newSiteUrlParams)
			) {
				return currentTemporarySite;
			}
		}

		const siteSlug = getUniqueSiteSlug(
			preferredSlug || deriveSlugFromSiteName(siteName),
			{
				// Temporary sites are removed before the new one is added, so they
				// should not force the replacement site to take a numeric suffix.
				unavailableSlugs: selectAllSites(getState())
					.filter((site) => site.metadata.storage !== 'none')
					.map((site) => site.slug),
			}
		);

		const sites = getState().sites.entities;

		// First, delete any existing temporary sites
		for (const site of Object.values(sites)) {
			if (site.metadata.storage === 'none') {
				dispatch(sitesSlice.actions.removeSite(site.slug));
			}
		}

		let resolvedBlueprint: ResolvedBlueprint | undefined = undefined;
		try {
			resolvedBlueprint = await resolveBlueprintFromURL(
				playgroundUrlWithQueryApiArgs,
				DEFAULT_BLUEPRINT
			);
		} catch (e) {
			logger.error(
				'Error resolving blueprint: Blueprint could not be downloaded or loaded.',
				e
			);

			// Check if the error (or its cause chain) is a FirewallInterferenceError
			if (findFirewallErrorInCauseChain(e)) {
				return showTemporarySiteError({
					error: 'network-firewall-interference',
					details: e,
				});
			}

			return showTemporarySiteError({
				error: 'blueprint-fetch-failed',
				details: e,
			});
		}

		try {
			resolvedBlueprint = await prepareResolvedBlueprint(
				resolvedBlueprint,
				playgroundUrlWithQueryApiArgs
			);
			const newSiteInfo: SiteInfo = {
				slug: siteSlug,
				originalUrlParams: newSiteUrlParams,
				metadata: {
					name: siteName,
					id: crypto.randomUUID(),
					whenCreated: Date.now(),
					storage: 'none' as const,
					sourceSetupUrlFingerprint: getAutosaveFingerprintFromURL(
						playgroundUrlWithQueryApiArgs
					),
					originalBlueprint: resolvedBlueprint.blueprint,
					originalBlueprintSource: resolvedBlueprint.source!,
					runtimeConfiguration: await resolveRuntimeConfiguration(
						resolvedBlueprint.blueprint
					)!,
				},
			};
			dispatch(sitesSlice.actions.addSite(newSiteInfo));
			dispatch(sitesSlice.actions.setFirstTemporarySiteCreated());
			return newSiteInfo;
		} catch (e) {
			logger.error(
				'Error preparing the Blueprint after it was downloaded.',
				e
			);
			const errorType =
				e instanceof InvalidBlueprintError
					? 'blueprint-validation-failed'
					: 'site-boot-failed';
			return showTemporarySiteError({ error: errorType, details: e });
		}
	};
}

/**
 * Creates the metadata record for a new OPFS-backed Playground.
 *
 * This intentionally overlaps with `setTemporarySiteSpec`: both capture the
 * setup URL, resolve the Blueprint, and derive the runtime configuration.
 * Stored sites diverge after that by writing OPFS metadata immediately, keeping
 * more than one site record, and marking the first file sync as pending. Boot
 * then uses the same setup URL to install WordPress in MEMFS before copying the
 * initialized files into OPFS.
 */
export function setStoredSiteSpec(
	siteName: string,
	playgroundUrlWithQueryApiArgs: URL,
	preferredSlug?: string,
	options: {
		/**
		 * Whether the stored site is an autosave or an explicit user save.
		 */
		persistence?: SitePersistence;
	} = {}
) {
	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		const siteSlug = getUniqueSiteSlug(
			preferredSlug || deriveSlugFromSiteName(siteName),
			{ unavailableSlugs: selectSiteSlugs(getState()) }
		);
		const originalUrlParams = getOriginalUrlParams(
			playgroundUrlWithQueryApiArgs
		);

		const resolvedBlueprint = await resolveSiteBlueprintFromUrl(
			playgroundUrlWithQueryApiArgs
		);
		const now = Date.now();
		const newSiteInfo: SiteInfo = {
			slug: siteSlug,
			originalUrlParams,
			metadata: {
				name: siteName,
				id: crypto.randomUUID(),
				whenCreated: now,
				whenLastUsed: now,
				persistence: options.persistence ?? 'explicit',
				storage: 'opfs' as const,
				initialOpfsSyncPending: true,
				sourceSetupUrlFingerprint: getAutosaveFingerprintFromURL(
					playgroundUrlWithQueryApiArgs
				),
				originalBlueprint: resolvedBlueprint.blueprint,
				originalBlueprintSource: resolvedBlueprint.source!,
				runtimeConfiguration: await resolveRuntimeConfiguration(
					resolvedBlueprint.blueprint
				)!,
			},
		};

		await dispatch(addSite(newSiteInfo));
		return newSiteInfo;
	};
}

/**
 * Replaces the setup metadata and WordPress files for an autosaved Playground
 * without changing its slug or display name.
 *
 * Autosaves are recoverable unsaved work. Explicitly saved Playgrounds preserve
 * their WordPress files, so they must not use this reset path.
 */
export function resetAutosavedSiteSpec(
	siteSlug: string,
	playgroundUrlWithQueryApiArgs: URL
) {
	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		const site = selectSiteBySlug(getState(), siteSlug);
		if (!site) {
			throw new Error(`Site not found: ${siteSlug}`);
		}
		if (!isAutosavedSite(site)) {
			throw new Error(
				`Cannot reset ${siteSlug}; only autosaved Playgrounds can be recreated in place.`
			);
		}

		const resolvedBlueprint = await resolveSiteBlueprintFromUrl(
			playgroundUrlWithQueryApiArgs
		);
		const runtimeConfiguration = (await resolveRuntimeConfiguration(
			resolvedBlueprint.blueprint
		))!;
		// Validate the new setup before deleting the old WordPress files so a
		// broken Blueprint URL does not destroy the existing autosave.
		// `isAutosavedSite()` requires OPFS storage; an autosaved site cannot be
		// selected in a browser session where OPFS storage is unavailable.
		await opfsSiteStorage!.resetSiteFiles(siteSlug);
		const now = Date.now();
		await dispatch(
			updateSite({
				slug: siteSlug,
				changes: {
					originalUrlParams: getOriginalUrlParams(
						playgroundUrlWithQueryApiArgs
					),
					metadata: {
						...site.metadata,
						whenCreated: now,
						whenLastUsed: now,
						initialOpfsSyncPending: true,
						/**
						 * Recreating an autosaved Playground discards the old
						 * WordPress files and boots from the updated setup.
						 * Constants discovered from the previous runtime may no
						 * longer exist in the recreated site, so they must be
						 * rediscovered after the first OPFS sync.
						 */
						playgroundDefinedConstants: undefined,
						sourceSetupUrlFingerprint:
							getAutosaveFingerprintFromURL(
								playgroundUrlWithQueryApiArgs
							),
						originalBlueprint: resolvedBlueprint.blueprint,
						originalBlueprintSource: resolvedBlueprint.source!,
						runtimeConfiguration,
					},
				},
			})
		);
	};
}

/**
 * Resolves the Blueprint that should initialize a site created from a URL.
 *
 * A URL without Blueprint-specific query args still needs a default Blueprint,
 * so saved-site creation uses the same welcome Blueprint fallback as temporary
 * site creation.
 */
async function resolveSiteBlueprintFromUrl(playgroundUrlWithQueryApiArgs: URL) {
	const resolvedBlueprint = await resolveBlueprintFromURL(
		playgroundUrlWithQueryApiArgs,
		DEFAULT_BLUEPRINT
	);
	return prepareResolvedBlueprint(
		resolvedBlueprint,
		playgroundUrlWithQueryApiArgs
	);
}

/**
 * Applies URL query overrides before storing Blueprint v1 declarations.
 *
 * `resolveBlueprintFromURL()` loads the Blueprint source, but runtime query
 * params such as `php`, `wp`, and `networking` still need to be folded into v1
 * Blueprints so the stored site boots from the same setup the URL requested.
 */
async function prepareResolvedBlueprint(
	resolvedBlueprint: ResolvedBlueprint,
	playgroundUrlWithQueryApiArgs: URL
) {
	const reflection = await BlueprintReflection.create(
		resolvedBlueprint.blueprint
	);
	if (reflection.getVersion() === 1) {
		resolvedBlueprint.blueprint = await applyQueryOverrides(
			resolvedBlueprint.blueprint,
			playgroundUrlWithQueryApiArgs.searchParams
		);
	}
	return resolvedBlueprint;
}

/**
 * Returns URL parts saved with a site so it can recreate its setup URL.
 *
 * Repeated query params stay as arrays because setup params such as `plugin`
 * and `php-extension` can appear more than once.
 */
function getOriginalUrlParams(
	url: URL
): NonNullable<SiteInfo['originalUrlParams']> {
	return {
		searchParams: parseSearchParams(url.searchParams),
		hash: url.hash,
	};
}

function parseSearchParams(searchParams: URLSearchParams) {
	const params: Record<string, string | string[]> = {};
	for (const key of searchParams.keys()) {
		const value = searchParams.getAll(key);
		params[key] = value.length > 1 ? value : value[0];
	}
	return params;
}

/**
 * The supported site storage types.
 *
 * Is it possible to restrict this to those three values for all Playground runtimes?
 * Or should the runtime be allowed to use custom storage types?
 *
 * NOTE: We are using different storage terms than our query API in order
 * to be more explicit about storage medium in the site metadata format.
 */
export const SiteStorageTypes = ['opfs', 'local-fs', 'none'] as const;
export type SiteStorageType = (typeof SiteStorageTypes)[number];

/**
 * The site logo data.
 */
export type SiteLogo = {
	mime: string;
	data: string;
};

// TODO: Create a schema for this as the design matures
/**
 * The Site metadata that is persisted.
 */
export interface SiteMetadata {
	storage: SiteStorageType;
	id: string;
	name: string;
	logo?: SiteLogo;

	// TODO: The designs show keeping admin username and password. Why do we want that?
	whenCreated?: number;
	whenLastUsed?: number;
	/**
	 * Whether this stored site is an automatic recovery copy or should be
	 * treated as explicitly saved. Missing means explicit for backwards
	 * compatibility with existing saved Playgrounds.
	 */
	persistence?: SitePersistence;
	/**
	 * Stable fingerprint of the setup URL that created this site, when known.
	 */
	sourceSetupUrlFingerprint?: string;
	/**
	 * Indicates that an OPFS-backed site still needs its first MEMFS-to-OPFS
	 * file sync.
	 *
	 * Sites created with `setStoredSiteSpec` start with metadata only. Their
	 * first boot must run from the setup URL, then copy initialized files into
	 * OPFS and clear this flag after a successful sync.
	 */
	initialOpfsSyncPending?: boolean;
	/**
	 * PHP constants discovered from the running Playground and persisted so
	 * they can be replayed after reload without changing the live boot config.
	 */
	playgroundDefinedConstants?: RuntimeConfiguration['constants'];

	// @TODO: Accept any string as a php version?
	runtimeConfiguration: RuntimeConfiguration;
	originalBlueprint: BlueprintV1;
	originalBlueprintSource: BlueprintSource;
}

export const { setOPFSSitesLoadingState } = sitesSlice.actions;
export { sitesSlice };

export const {
	selectAll: selectAllSites,
	selectById: selectSiteBySlug,
	selectIds: selectSiteSlugs,
} = sitesAdapter.getSelectors(
	(state: { sites: ReturnType<typeof sitesSlice.reducer> }) => state.sites
);

export const selectSortedSites = createSelector(
	[selectAllSites],
	(sites: SiteInfo[]) => getSitesSortedByRecency(sites)
);

export const selectTemporarySite = createSelector(
	[selectAllSites],
	(sites: SiteInfo[]) => {
		return sites.find((site) => site.metadata.storage === 'none');
	}
);

export const selectTemporarySites = createSelector(
	[selectAllSites],
	(sites: SiteInfo[]) => {
		return sites.filter((site) => site.metadata.storage === 'none');
	}
);

export const selectSitesLoaded = createSelector(
	[
		(state: { sites: ReturnType<typeof sitesSlice.reducer> }) =>
			state.sites.opfsSitesLoadingState,
		(state: { sites: ReturnType<typeof sitesSlice.reducer> }) =>
			state.sites.firstTemporarySiteCreated,
		(state) => selectActiveSite(state),
	],
	(opfsSitesLoadingState, firstTemporarySiteCreated, activeSite) =>
		['loaded', 'error'].includes(opfsSitesLoadingState) &&
		((activeSite && activeSite.metadata.storage !== 'none') ||
			firstTemporarySiteCreated)
);

export default sitesSlice.reducer;
