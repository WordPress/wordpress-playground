import type { PayloadAction } from '@reduxjs/toolkit';
import {
	createSlice,
	createEntityAdapter,
	createSelector,
} from '@reduxjs/toolkit';
import type { PlaygroundDispatch, PlaygroundReduxState } from './store';
import { selectActiveSite, setActiveSite } from './store';
import {
	blueprintBundleLoadErrorSymbol,
	legacyOpfsPathSymbol,
	opfsSiteStorage,
} from '../opfs/opfs-site-storage';
import { resetAutosavedSiteFilesWithPendingMarker } from '../opfs/opfs-autosave-reset';
import type { OriginalUrlParams } from '../original-url-params';
import {
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
import {
	deletePersistedBlueprintBundleVersion,
	isTraversableFilesystemBackend,
	persistBlueprintBundle,
	type PersistedBlueprintBundle,
} from '../opfs/opfs-blueprint-bundle-storage';
import type { TraversableFilesystemBackend } from '@wp-playground/storage';
import { logger } from '@php-wasm/logger';
import { setActiveSiteError, type SiteError } from './slice-ui';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { findFirewallErrorInCauseChain } from './error-utils';
import { deriveSlugFromSiteName, getUniqueSiteSlug } from './site-slug';
import {
	getAutosavedSitesToPrune,
	getSitesSortedByRecency,
	isAutosavedSite,
	isStoredSite,
	isTemporarySite,
	type AutosavedSitesPruneOptions,
	type SitePersistence,
} from './site-lifecycle';
import {
	getAutosaveFingerprintFromURL,
	getRuntimeBootFingerprint,
} from '../playground-identity';
import {
	getDefaultSiteNameFromBlueprint,
	getSiteNameWithCreationTimeIfDuplicate,
} from './site-name';
import {
	getCurrentSiteBootSignal,
	runWithExclusiveSiteRuntimeLock,
	SiteRuntimeLockUnavailableError,
	suspendCurrentSiteRuntime,
	type SiteRuntimeSuspension,
} from '../site-runtime-lock';
import { removeClientInfo, selectClientInfoBySiteSlug } from './slice-clients';
export {
	MAX_AUTOSAVED_SITES,
	SitePersistenceTypes,
	getAutosavedSitesToPrune,
	getSiteRecencyTimestamp,
	getSitesSortedByRecency,
	getSitePublicPersistence,
	isAutosavedSite,
	isExplicitlySavedSite,
	isOpfsBackedSite,
	isStoredSite,
	isTemporarySite,
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
	loadedFromStorage?: boolean;
	originalUrlParams?: OriginalUrlParams;
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
			allSites[site.slug] = {
				...site,
				loadedFromStorage: true,
			};
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
		if (!selectSiteBySlug(getState(), slug)) {
			throw new Error(`Site not found: ${slug}`);
		}
		await dispatch(
			updateSite({
				slug,
				changes: {
					metadata: changes,
				},
			})
		);
	};
}

/**
 * Merges runtime settings from the latest queued site state.
 *
 * Callers pass only the setting they own so concurrent PHP and networking
 * changes cannot restore one another's stale runtime configuration snapshot.
 */
export function updateSiteRuntimeConfiguration({
	slug,
	changes,
}: {
	slug: string;
	changes: Partial<RuntimeConfiguration>;
}) {
	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		return serializeSiteUpdate(slug, async () => {
			const currentSite = await getAuthoritativeSiteWhileLocked(
				slug,
				getState
			);
			if (!currentSite) {
				throw new Error(`Site not found: ${slug}`);
			}
			await commitSiteUpdateWhileLocked(
				{
					slug,
					changes: {
						metadata: {
							runtimeConfiguration: {
								...currentSite.metadata.runtimeConfiguration,
								...changes,
							},
						},
					},
				},
				dispatch,
				getState
			);
		});
	};
}

type SiteSetupRevision = Pick<
	SiteMetadata,
	'id' | 'whenCreated' | 'sourceSetupUrlFingerprint' | 'runtimeConfiguration'
>;

/**
 * Copies an editable Blueprint into OPFS while its site still owns the setup.
 *
 * The bundle copy and metadata commit share the site's update queue. Setup
 * replacement uses the same queue, so stale promotion work cannot overwrite a
 * newer setup's bundle before discovering that its metadata commit is stale.
 * Preserving the same OPFS setup does not cancel promotion of its only draft.
 */
export function persistBlueprintBundleForSetup({
	slug,
	expectedSetup,
	source,
}: {
	slug: string;
	expectedSetup: SiteSetupRevision;
	source: TraversableFilesystemBackend;
}) {
	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		return serializeSiteUpdate(slug, async () => {
			let currentSite = await getAuthoritativeSiteWhileLocked(
				slug,
				getState
			);
			if (
				!currentSite ||
				currentSite.metadata.storage !== 'opfs' ||
				!siteOwnsSetupRevision(currentSite, expectedSetup)
			) {
				return null;
			}
			const siteBeforeBundleCopy = currentSite;

			const persistedBundle = await persistBlueprintBundle(
				slug,
				source,
				isTraversableFilesystemBackend(
					currentSite.metadata.originalBlueprint
				)
					? currentSite.metadata.originalBlueprint
					: undefined,
				(currentSite.metadata as any)[legacyOpfsPathSymbol]
			);
			try {
				currentSite = await getAuthoritativeSiteWhileLocked(
					slug,
					getState
				);
			} catch (error) {
				await deleteBlueprintBundleVersionIfUnselected(
					slug,
					persistedBundle,
					siteBeforeBundleCopy
				);
				throw error;
			}
			if (
				!currentSite ||
				currentSite.metadata.storage !== 'opfs' ||
				!siteOwnsSetupRevision(currentSite, expectedSetup)
			) {
				await deleteBlueprintBundleVersionIfUnselected(
					slug,
					persistedBundle,
					currentSite
				);
				return null;
			}

			const updatedMetadata = {
				...currentSite.metadata,
				originalBlueprint: persistedBundle.backend,
				originalBlueprintSource: {
					type: 'opfs-site' as const,
					directory: persistedBundle.directory,
				},
			};
			if (updatedMetadata.storage !== 'none') {
				if (!opfsSiteStorage) {
					throw new Error(
						'Cannot update a saved Playground because browser storage is not available.'
					);
				}
				try {
					await opfsSiteStorage.update(
						currentSite.slug,
						updatedMetadata,
						currentSite.originalUrlParams
					);
				} catch (error) {
					let durableSite: SiteInfo | undefined;
					try {
						durableSite = await opfsSiteStorage.read(slug);
					} catch {
						throw error;
					}
					await deleteBlueprintBundleVersionIfUnselected(
						slug,
						persistedBundle,
						durableSite
					);
					throw error;
				}
			}

			currentSite = await getAuthoritativeSiteWhileLocked(slug, getState);
			if (
				!currentSite ||
				currentSite.metadata.storage !== 'opfs' ||
				!siteOwnsSetupRevision(currentSite, expectedSetup)
			) {
				if (
					currentSite?.metadata.storage !== 'none' &&
					opfsSiteStorage
				) {
					await opfsSiteStorage.update(
						currentSite.slug,
						currentSite.metadata,
						currentSite.originalUrlParams
					);
				}
				await deleteBlueprintBundleVersionIfUnselected(
					slug,
					persistedBundle,
					currentSite
				);
				return null;
			}

			dispatch(
				sitesSlice.actions.updateSite({
					id: slug,
					changes: { metadata: updatedMetadata },
				})
			);
			return persistedBundle.backend;
		});
	};
}

/**
 * Replaces an autosave's setup without racing Blueprint bundle promotion.
 *
 * The optional bundle copy, crash-safe WordPress file reset, and Redux commit
 * are one serialized site operation. A caller that resolved an obsolete setup
 * gets `false` before any persisted files are changed. The preparation callback
 * suspends the current runtime, then an optional bundle is staged in an
 * unselected version before selected metadata or WordPress files are changed.
 * It must not dispatch another site operation for the same slug, because this
 * operation holds that site's queue until the callback settles.
 */
export function replaceAutosavedSiteSetup({
	slug,
	expectedSetup,
	changes,
	blueprintBundle,
	prepareForWordPressFileReset,
}: {
	slug: string;
	expectedSetup: SiteSetupRevision;
	changes: {
		loadedFromStorage?: SiteInfo['loadedFromStorage'];
		metadata: Partial<SiteMetadata>;
		originalUrlParams: SiteInfo['originalUrlParams'];
	};
	blueprintBundle?: TraversableFilesystemBackend;
	prepareForWordPressFileReset?: () => Promise<
		SiteRuntimeSuspension | undefined
	>;
}) {
	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		return serializeSiteUpdate(slug, async () => {
			const currentSite = await getAuthoritativeSiteWhileLocked(
				slug,
				getState
			);
			if (
				!currentSite ||
				!isAutosavedSite(currentSite) ||
				!siteOwnsSetupRevision(currentSite, expectedSetup)
			) {
				return false;
			}
			try {
				return await runWithExclusiveSiteRuntimeLock(
					slug,
					async () => {
						let persistedBundle:
							| Awaited<ReturnType<typeof persistBlueprintBundle>>
							| undefined;
						if (blueprintBundle) {
							try {
								persistedBundle = await persistBlueprintBundle(
									slug,
									blueprintBundle,
									isTraversableFilesystemBackend(
										currentSite.metadata.originalBlueprint
									)
										? currentSite.metadata.originalBlueprint
										: undefined,
									(currentSite.metadata as any)[
										legacyOpfsPathSymbol
									]
								);
							} catch (error) {
								throw new AutosavedSiteResetDidNotStartError(
									error
								);
							}
						}
						const nextMetadata = mergeSiteSetupMetadata(
							currentSite.metadata,
							{
								...changes.metadata,
								...(persistedBundle
									? {
											originalBlueprint:
												persistedBundle.backend,
											originalBlueprintSource: {
												type: 'opfs-site' as const,
												directory:
													persistedBundle.directory,
											},
										}
									: {}),
							}
						);
						const persistedChanges = {
							...changes,
							metadata: nextMetadata,
						};
						let completedChanges: typeof persistedChanges;
						try {
							completedChanges =
								await resetAutosavedSiteFilesWithPendingMarker(
									slug,
									persistedChanges
								);
						} catch (error) {
							if (!opfsSiteStorage) {
								throw new AutosavedSiteResetDidNotStartError(
									error
								);
							}
							const pendingRecoveryChanges = {
								...persistedChanges,
								metadata: {
									...persistedChanges.metadata,
									opfsSiteRemovalPending: true,
								},
							};
							let durableSite: SiteInfo | undefined;
							try {
								durableSite = await opfsSiteStorage.read(slug);
							} catch (readError) {
								// The destructive phase started, so the old iframe may not
								// resume. Advance the local generation into crash recovery;
								// boot will retry the authoritative read before mounting OPFS.
								dispatch(
									sitesSlice.actions.updateSite({
										id: slug,
										changes: pendingRecoveryChanges,
									})
								);
								throw new AggregateError(
									[error, readError],
									'Could not read storage after the Playground reset failed.'
								);
							}
							if (
								durableSite &&
								siteOwnsSetupRevision(durableSite, {
									id: currentSite.metadata.id,
									whenCreated:
										currentSite.metadata.whenCreated,
									runtimeConfiguration:
										currentSite.metadata
											.runtimeConfiguration,
									sourceSetupUrlFingerprint:
										currentSite.metadata
											.sourceSetupUrlFingerprint,
								}) &&
								!durableSite.metadata.opfsSiteRemovalPending
							) {
								if (persistedBundle) {
									await deleteBlueprintBundleVersionIfUnselected(
										slug,
										persistedBundle,
										durableSite
									);
								}
								throw new AutosavedSiteResetDidNotStartError(
									error
								);
							}
							if (
								durableSite?.metadata.id ===
								currentSite.metadata.id
							) {
								dispatch(
									sitesSlice.actions.updateSite({
										id: slug,
										changes: {
											loadedFromStorage:
												durableSite.loadedFromStorage,
											originalUrlParams:
												durableSite.originalUrlParams,
											metadata: durableSite.metadata,
										},
									})
								);
							} else {
								// Missing or replaced metadata is not safe to pair with the
								// detached old iframe. Force the next boot through recovery;
								// its authoritative owner check will stop before mounting.
								dispatch(
									sitesSlice.actions.updateSite({
										id: slug,
										changes: pendingRecoveryChanges,
									})
								);
							}
							throw error;
						}
						dispatch(
							sitesSlice.actions.updateSite({
								id: slug,
								changes: completedChanges,
							})
						);
						return true;
					},
					{
						suspendCurrentRuntime: prepareForWordPressFileReset,
						canRestoreAfterOperationFailure: (error) =>
							error instanceof AutosavedSiteResetDidNotStartError,
					}
				);
			} catch (error) {
				if (error instanceof AutosavedSiteResetDidNotStartError) {
					throw error.originalError;
				}
				throw error;
			}
		});
	};
}

/** Marks a reset failure that left the selected durable setup untouched. */
class AutosavedSiteResetDidNotStartError extends Error {
	readonly originalError: unknown;

	constructor(originalError: unknown) {
		super('Autosaved Playground reset did not change durable storage.');
		this.name = 'AutosavedSiteResetDidNotStartError';
		this.originalError = originalError;
	}
}

/**
 * Finishes a crash-interrupted autosave reset under the site's cross-tab lock.
 *
 * Durable metadata selects the exact versioned Blueprint directory to retain;
 * the pending marker is cleared in the same transaction as file cleanup.
 */
export function finishPendingAutosavedSiteReset(slug: string) {
	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		return serializeSiteUpdate(slug, async () => {
			const currentSite = await getAuthoritativeSiteWhileLocked(
				slug,
				getState
			);
			if (!currentSite?.metadata.opfsSiteRemovalPending) {
				if (currentSite) {
					dispatch(
						sitesSlice.actions.updateSite({
							id: slug,
							changes: {
								originalUrlParams:
									currentSite.originalUrlParams,
								metadata: currentSite.metadata,
							},
						})
					);
				}
				return currentSite;
			}
			return runWithExclusiveSiteRuntimeLock(slug, async () => {
				if (!opfsSiteStorage) {
					throw new Error(
						'Cannot finish resetting a saved Playground because browser storage is not available.'
					);
				}
				const bundleDirectory =
					currentSite.metadata.originalBlueprintSource?.type ===
					'opfs-site'
						? currentSite.metadata.originalBlueprintSource.directory
						: undefined;
				await opfsSiteStorage.removeWordPressFilesKeepMetadata(
					slug,
					bundleDirectory
				);
				await commitSiteUpdateWhileLocked(
					{
						slug,
						changes: {
							metadata: {
								opfsSiteRemovalPending: undefined,
							},
						},
					},
					dispatch,
					getState
				);
				return selectSiteBySlug(getState(), slug);
			});
		});
	};
}

/**
 * Replaces a temporary site's setup only while it remains temporary.
 *
 * Saving and setup replacement use the same site queue. The preparation
 * callback therefore cannot tear down a client that has already become stored.
 * It must not dispatch another site operation for the same slug.
 */
export function replaceTemporarySiteSetup({
	slug,
	expectedSetup,
	changes,
	prepareForSetupReplacement,
}: {
	slug: string;
	expectedSetup: SiteSetupRevision;
	changes: {
		metadata: Partial<SiteMetadata>;
		originalUrlParams: SiteInfo['originalUrlParams'];
	};
	prepareForSetupReplacement: () => void;
}) {
	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		return serializeSiteUpdate(slug, async () => {
			const currentSite = selectSiteBySlug(getState(), slug);
			if (
				!currentSite ||
				currentSite.metadata.storage !== 'none' ||
				!siteOwnsSetupRevision(currentSite, expectedSetup)
			) {
				return false;
			}
			prepareForSetupReplacement();
			const nextMetadata = mergeSiteSetupMetadata(
				currentSite.metadata,
				changes.metadata
			);
			dispatch(
				sitesSlice.actions.updateSite({
					id: slug,
					changes: {
						...changes,
						metadata: nextMetadata,
					},
				})
			);
			return true;
		});
	};
}

/** Merges setup metadata and guarantees that its viewport generation advances. */
function mergeSiteSetupMetadata(
	currentMetadata: SiteMetadata,
	changes: Partial<SiteMetadata>
) {
	const nextMetadata = { ...currentMetadata, ...changes };
	if (
		changes.whenCreated !== undefined &&
		currentMetadata.whenCreated !== undefined
	) {
		nextMetadata.whenCreated = Math.max(
			changes.whenCreated,
			currentMetadata.whenCreated + 1
		);
	}
	return nextMetadata;
}

/** Reports whether a site still owns the setup revision captured by a caller. */
function siteOwnsSetupRevision(
	site: SiteInfo,
	expectedSetup: SiteSetupRevision
) {
	return (
		site.metadata.id === expectedSetup.id &&
		site.metadata.whenCreated === expectedSetup.whenCreated &&
		site.metadata.sourceSetupUrlFingerprint ===
			expectedSetup.sourceSetupUrlFingerprint &&
		getRuntimeBootFingerprint(site.metadata.runtimeConfiguration) ===
			getRuntimeBootFingerprint(expectedSetup.runtimeConfiguration)
	);
}

/**
 * Reads the durable site record while its browser-wide update lock is held.
 *
 * Stored-site mutations must merge from OPFS rather than a tab-local Redux
 * snapshot. A reused slug with a different site id is detected and rejected so
 * a stale caller cannot overwrite the new owner.
 */
export async function getAuthoritativeSiteWhileLocked(
	slug: string,
	getState: () => PlaygroundReduxState
) {
	const localSite = selectSiteBySlug(getState(), slug);
	if (!localSite || localSite.metadata.storage === 'none') {
		return localSite;
	}
	const siteStorage = opfsSiteStorage;
	if (!siteStorage) {
		throw new Error(
			'Cannot read a saved Playground because browser storage is not available.'
		);
	}
	let persistedSite: SiteInfo | undefined;
	try {
		persistedSite = await siteStorage.read(slug);
	} catch (error) {
		throw new Error(`Cannot read saved Playground: ${slug}`, {
			cause: error,
		});
	}
	if (!persistedSite) {
		throw new Error(`Site not found in browser storage: ${slug}`);
	}
	if (persistedSite.metadata.id !== localSite.metadata.id) {
		throw new Error(`Site owner changed in browser storage: ${slug}`);
	}
	const persistedSource = persistedSite.metadata.originalBlueprintSource;
	const localSource = localSite.metadata.originalBlueprintSource;
	if (
		(persistedSite.metadata as any)[blueprintBundleLoadErrorSymbol] &&
		persistedSource?.type === 'opfs-site' &&
		localSource?.type === 'opfs-site' &&
		persistedSource.directory === localSource.directory &&
		isTraversableFilesystemBackend(localSite.metadata.originalBlueprint)
	) {
		// A transient OPFS read must not replace a live, same-version backend
		// with `undefined`. Keeping that exact selected version is safe; using
		// an empty fallback would let the editor overwrite it on promotion.
		persistedSite.metadata.originalBlueprint =
			localSite.metadata.originalBlueprint;
		delete (persistedSite.metadata as any)[blueprintBundleLoadErrorSymbol];
	}
	return { ...localSite, ...persistedSite };
}

/**
 * Reconciles tab-local Redux state after waiting for a site's runtime lock.
 *
 * An exclusive reset in another tab may complete while boot is queued for its
 * shared OPFS lock. Boot must re-read durable metadata before mounting files,
 * otherwise it can combine the new directory contents with an old setup.
 */
export function refreshSiteFromStorage(slug: string) {
	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		return serializeSiteUpdate(slug, async () => {
			const site = await getAuthoritativeSiteWhileLocked(slug, getState);
			if (!site) {
				throw new Error(`Site not found: ${slug}`);
			}
			dispatch(
				sitesSlice.actions.updateSite({
					id: slug,
					changes: {
						loadedFromStorage: site.loadedFromStorage,
						originalUrlParams: site.originalUrlParams,
						metadata: site.metadata,
					},
				})
			);
			return site;
		});
	};
}

/**
 * Marks a stored Playground as explicitly saved.
 *
 * This removes autosaved OPFS Playgrounds from autosave pruning. Temporary
 * Playgrounds must be saved before they can be preserved.
 */
export function preserveSite(slug: string, name?: string) {
	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		return serializeAutosaveLifecycle(async () => {
			const site = selectSiteBySlug(getState(), slug);
			if (!site) {
				throw new Error(`Site not found: ${slug}`);
			}
			if (site.metadata.storage === 'none') {
				throw new Error(
					'Cannot preserve a temporary site. Save it first.'
				);
			}
			const trimmedName = name?.trim();
			await dispatch(
				updateSiteMetadata({
					slug,
					changes: {
						persistence: 'explicit',
						...(trimmedName ? { name: trimmedName } : {}),
					},
				})
			);
		});
	};
}

type SiteInfoChanges = Omit<Partial<SiteInfo>, 'metadata'> & {
	metadata?: Partial<SiteMetadata>;
};

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
	changes: SiteInfoChanges;
}) {
	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		return serializeSiteUpdate(slug, () =>
			commitSiteUpdateWhileLocked({ slug, changes }, dispatch, getState)
		);
	};
}

/**
 * Commits site changes for a caller that already owns the site's update queue.
 *
 * Calling this without `serializeSiteUpdate` allows storage and Redux state to
 * diverge. It is exported only for multi-step site transactions that must keep
 * the queue across filesystem work and their final metadata commit.
 */
export async function commitSiteUpdateWhileLocked(
	{
		slug,
		changes,
	}: {
		slug: string;
		changes: SiteInfoChanges;
	},
	dispatch: PlaygroundDispatch,
	getState: () => PlaygroundReduxState
) {
	if ('storage' in changes) {
		throw new Error('Cannot update storage for a site.');
	}
	const existingSite = await getAuthoritativeSiteWhileLocked(slug, getState);
	if (!existingSite) {
		throw new Error(`Site not found: ${slug}`);
	}
	const { metadata, ...topLevelChanges } = changes;
	const updatedSite = {
		...existingSite,
		...topLevelChanges,
		metadata: metadata
			? {
					...existingSite.metadata,
					...metadata,
				}
			: existingSite.metadata,
	};
	if (updatedSite.metadata.storage !== 'none') {
		if (!opfsSiteStorage) {
			throw new Error(
				'Cannot update a saved Playground because browser storage is not available.'
			);
		}
		await opfsSiteStorage.update(
			updatedSite.slug,
			updatedSite.metadata,
			updatedSite.originalUrlParams
		);
	}
	dispatch(
		sitesSlice.actions.updateSite({
			id: slug,
			changes: {
				loadedFromStorage: updatedSite.loadedFromStorage,
				originalUrlParams: updatedSite.originalUrlParams,
				...topLevelChanges,
				metadata: updatedSite.metadata,
			},
		})
	);
}

const siteUpdateQueues = new Map<string, Promise<void>>();
let siteCreationQueue = Promise.resolve();
let autosaveLifecycleQueue = Promise.resolve();

/**
 * Serializes one site's storage, lifecycle, and Redux state changes.
 *
 * An operation must not await another serialized operation for the same slug.
 */
export async function serializeSiteUpdate<T>(
	slug: string,
	operation: () => Promise<T>
): Promise<T> {
	const previous = siteUpdateQueues.get(slug) ?? Promise.resolve();
	const current = previous
		.catch(() => undefined)
		.then(() => runWithSiteBrowserLock(slug, operation));
	const completion = current.then(
		() => undefined,
		() => undefined
	);
	siteUpdateQueues.set(slug, completion);
	try {
		return await current;
	} finally {
		if (siteUpdateQueues.get(slug) === completion) {
			siteUpdateQueues.delete(slug);
		}
	}
}

/** Coordinates a site's metadata and destructive filesystem work across tabs. */
async function runWithSiteBrowserLock<T>(
	slug: string,
	operation: () => Promise<T>
) {
	if (typeof navigator !== 'undefined' && navigator.locks) {
		return navigator.locks.request(
			`wordpress-playground-site:${slug}`,
			operation
		);
	}
	return operation();
}

/**
 * Serializes autosave creation, preservation, and pruning across browser tabs.
 *
 * Retention is a collection-wide invariant. Per-site locks cannot stop one tab
 * from pruning an autosave while another tab is turning it into an explicit
 * save or adding the replacement that changed the retention set.
 */
export async function serializeAutosaveLifecycle<T>(
	operation: () => Promise<T>
): Promise<T> {
	const current = autosaveLifecycleQueue
		.catch(() => undefined)
		.then(() => runWithAutosaveLifecycleBrowserLock(operation));
	autosaveLifecycleQueue = current.then(
		() => undefined,
		() => undefined
	);
	return current;
}

/** Coordinates collection-wide autosave lifecycle decisions across tabs. */
async function runWithAutosaveLifecycleBrowserLock<T>(
	operation: () => Promise<T>
) {
	if (typeof navigator !== 'undefined' && navigator.locks) {
		return navigator.locks.request(
			'wordpress-playground-autosave-lifecycle',
			operation
		);
	}
	return operation();
}

/** Serializes slug allocation and creation across temporary and stored sites. */
async function serializeSiteCreation<T>(
	operation: () => Promise<T>
): Promise<T> {
	const current = siteCreationQueue.catch(() => undefined).then(operation);
	siteCreationQueue = current.then(
		() => undefined,
		() => undefined
	);
	return current;
}

/** Serializes stored-site slug allocation and OPFS creation across tabs. */
async function serializeStoredSiteCreation<T>(
	operation: () => Promise<T>
): Promise<T> {
	return serializeSiteCreation(() => {
		if (typeof navigator !== 'undefined' && navigator.locks) {
			return navigator.locks.request(
				'wordpress-playground-stored-site-creation',
				operation
			);
		}
		return operation();
	});
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
		return serializeSiteUpdate(siteInfo.slug, () =>
			addSiteWhileLocked(siteInfo, dispatch, getState)
		);
	};
}

/**
 * Creates a stored site for a caller that already owns its update queue.
 *
 * `reusePreparedDirectory` is only for creation flows that cleared the path and
 * then staged a versioned Blueprint bundle there under the same browser locks.
 */
async function addSiteWhileLocked(
	siteInfo: SiteInfo,
	dispatch: PlaygroundDispatch,
	getState: () => PlaygroundReduxState,
	reusePreparedDirectory = false
) {
	if (selectSiteBySlug(getState(), siteInfo.slug)) {
		throw new Error(`Site already exists: ${siteInfo.slug}`);
	}
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
	if (reusePreparedDirectory) {
		await opfsSiteStorage.create(
			siteInfo.slug,
			siteInfo.metadata,
			siteInfo.originalUrlParams,
			{ reusePreparedDirectory: true }
		);
	} else {
		await opfsSiteStorage.create(
			siteInfo.slug,
			siteInfo.metadata,
			siteInfo.originalUrlParams
		);
	}
	dispatch(sitesSlice.actions.addSite(siteInfo));
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
		return serializeSiteUpdate(slug, () =>
			removeSiteWhileLocked(slug, dispatch, getState)
		);
	};
}

/**
 * Removes a stored site after every mounted runtime has released its files.
 *
 * The caller already owns the site's metadata queue. A runtime in this tab is
 * detached and discarded; a runtime in another tab makes the bounded exclusive
 * lock fail instead of racing recursive directory deletion.
 */
async function removeSiteWhileLocked(
	slug: string,
	dispatch: PlaygroundDispatch,
	getState: () => PlaygroundReduxState,
	expectedAutosave?: Pick<SiteMetadata, 'id' | 'whenCreated' | 'whenLastUsed'>
) {
	const activeSite = selectActiveSite(getState());
	const siteInfo = await getAuthoritativeSiteWhileLocked(slug, getState);
	if (!siteInfo) {
		throw new Error(`Site not found: ${slug}`);
	}
	if (
		expectedAutosave !== undefined &&
		(!isAutosavedSite(siteInfo) ||
			siteInfo.metadata.id !== expectedAutosave.id ||
			siteInfo.metadata.whenCreated !== expectedAutosave.whenCreated ||
			siteInfo.metadata.whenLastUsed !== expectedAutosave.whenLastUsed)
	) {
		return false;
	}
	if (siteInfo.metadata.storage === 'none') {
		throw new Error('Cannot remove a temporary site.');
	}
	const siteStorage = opfsSiteStorage;
	if (!siteStorage) {
		throw new Error(
			'Cannot remove a saved Playground because browser storage is not available.'
		);
	}
	await runWithExclusiveSiteRuntimeLock(
		siteInfo.slug,
		() => siteStorage.delete(siteInfo.slug),
		{
			suspendCurrentRuntime: () =>
				suspendSiteRuntimeForDeletion(
					siteInfo.slug,
					dispatch,
					getState
				),
		}
	);
	dispatch(sitesSlice.actions.removeSite(siteInfo.slug));

	// Select the most recently created site
	if (activeSite?.slug === siteInfo.slug) {
		const newActiveSite = selectSortedSites(getState())[0];
		if (newActiveSite) {
			dispatch(setActiveSite(newActiveSite.slug));
		}
	}
	return true;
}

/** Detaches this tab's matching runtime before its saved files are deleted. */
async function suspendSiteRuntimeForDeletion(
	siteSlug: string,
	dispatch: PlaygroundDispatch,
	getState: () => PlaygroundReduxState
): Promise<SiteRuntimeSuspension | undefined> {
	const currentClientInfo = selectClientInfoBySiteSlug(getState(), siteSlug);
	const currentBootSignal = getCurrentSiteBootSignal(siteSlug);
	if (!currentClientInfo?.client || !currentClientInfo.opfsMountDescriptor) {
		if (!currentBootSignal) {
			return undefined;
		}
		throw new Error(
			'Wait for the Playground to finish loading before deleting it.'
		);
	}
	if (!currentBootSignal) {
		throw new Error(`Cannot find the active Playground boot: ${siteSlug}`);
	}
	return suspendCurrentSiteRuntime({
		siteSlug,
		playground: currentClientInfo.client,
		mountDescriptor: currentClientInfo.opfsMountDescriptor,
		onDiscard: () => {
			if (
				selectClientInfoBySiteSlug(getState(), siteSlug)?.client ===
				currentClientInfo.client
			) {
				dispatch(removeClientInfo(siteSlug));
			}
		},
	});
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
		await serializeAutosaveLifecycle(async () => {
			const skippedSlugs = new Set(options.excludeSlugs ?? []);
			/** Returns retention options including runtimes found open this pass. */
			const getCurrentPruneOptions = () => ({
				...options,
				excludeSlugs: Array.from(skippedSlugs),
			});
			while (true) {
				const sitesToPrune = getAutosavedSitesToPrune(
					await getSitesForAutosavePruning(getState),
					getCurrentPruneOptions()
				);
				const expectedSite = sitesToPrune[0];
				if (!expectedSite) {
					return;
				}

				let removed = false;
				await serializeSiteUpdate(expectedSite.slug, async () => {
					const currentCandidate = getAutosavedSitesToPrune(
						await getSitesForAutosavePruning(getState),
						getCurrentPruneOptions()
					).find(
						(candidate) =>
							candidate.slug === expectedSite.slug &&
							candidate.metadata.id ===
								expectedSite.metadata.id &&
							candidate.metadata.whenCreated ===
								expectedSite.metadata.whenCreated &&
							candidate.metadata.whenLastUsed ===
								expectedSite.metadata.whenLastUsed
					);
					if (!currentCandidate) {
						return;
					}

					const siteStorage = opfsSiteStorage;
					if (!siteStorage) {
						await removeSiteWhileLocked(
							currentCandidate.slug,
							dispatch,
							getState,
							{
								id: currentCandidate.metadata.id,
								whenCreated:
									currentCandidate.metadata.whenCreated,
								whenLastUsed:
									currentCandidate.metadata.whenLastUsed,
							}
						);
						removed = true;
						return;
					}

					try {
						await runWithExclusiveSiteRuntimeLock(
							currentCandidate.slug,
							() => siteStorage.delete(currentCandidate.slug)
						);
					} catch (error) {
						if (error instanceof SiteRuntimeLockUnavailableError) {
							skippedSlugs.add(currentCandidate.slug);
							return;
						}
						throw error;
					}
					const localSite = selectSiteBySlug(
						getState(),
						currentCandidate.slug
					);
					if (
						localSite?.metadata.id === currentCandidate.metadata.id
					) {
						const wasActive =
							selectActiveSite(getState())?.slug ===
							currentCandidate.slug;
						dispatch(
							sitesSlice.actions.removeSite(currentCandidate.slug)
						);
						if (wasActive) {
							const nextSite = selectSortedSites(getState())[0];
							if (nextSite) {
								dispatch(setActiveSite(nextSite.slug));
							}
						}
					}
					removed = true;
				});
				if (!removed) {
					// The candidate changed while its site lock was queued. Re-read
					// the collection once; a stable candidate will be removed next.
					continue;
				}
			}
		});
	};
}

/** Reads the durable collection used for collection-wide retention decisions. */
async function getSitesForAutosavePruning(
	getState: () => PlaygroundReduxState
) {
	if (opfsSiteStorage) {
		return opfsSiteStorage.list();
	}
	return selectAllSites(getState());
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
		return serializeSiteCreation(() =>
			setTemporarySiteSpecWhileLocked(
				siteName,
				playgroundUrlWithQueryApiArgs,
				preferredSlug,
				dispatch,
				getState
			)
		);
	};
}

/**
 * Resolves and installs one temporary site while replacement requests are serialized.
 */
async function setTemporarySiteSpecWhileLocked(
	siteName: string,
	playgroundUrlWithQueryApiArgs: URL,
	preferredSlug: string | undefined,
	dispatch: PlaygroundDispatch,
	getState: () => PlaygroundReduxState
) {
	const newSiteUrlParams = getOriginalUrlParams(
		playgroundUrlWithQueryApiArgs
	);

	const showTemporarySiteError = async (params: {
		error: SiteError;
		details: unknown;
	}) => {
		siteSlug = getAvailableSiteSlug(siteName);
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
			errorSite.metadata.originalBlueprint = resolvedBlueprint.blueprint;
			errorSite.metadata.originalBlueprintSource =
				resolvedBlueprint.source;
		} else if (params.details instanceof BlueprintFetchError) {
			errorSite.metadata.originalBlueprintSource = {
				type: 'remote-url',
				url: params.details.url,
			};
		}

		await serializeSiteUpdate(siteSlug, async () => {
			dispatch(sitesSlice.actions.addSite(errorSite));
			dispatch(sitesSlice.actions.setFirstTemporarySiteCreated());
		});

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

	const sites = getState().sites.entities;

	// First, delete any existing temporary sites
	for (const site of Object.values(sites)) {
		if (site.metadata.storage === 'none') {
			await serializeSiteUpdate(site.slug, async () => {
				const currentSite = selectSiteBySlug(getState(), site.slug);
				if (currentSite?.metadata.storage === 'none') {
					dispatch(sitesSlice.actions.removeSite(site.slug));
				}
			});
		}
	}

	// Temporary sites are removed before the new one is added, so they
	// should not force the replacement site to take a numeric suffix. Read
	// stored sites on each call because a concurrent save may have just won the
	// old temporary site's queue.
	/** Returns current non-temporary owners for name and slug allocation. */
	const getStoredSites = () =>
		selectAllSites(getState()).filter(
			(site) => site.metadata.storage !== 'none'
		);
	const getAvailableSiteSlug = (name: string) =>
		getUniqueSiteSlug(preferredSlug || deriveSlugFromSiteName(name), {
			unavailableSlugs: getStoredSites().map((site) => site.slug),
		});
	let siteSlug = getAvailableSiteSlug(siteName);

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
		let displayName = siteName;
		let slugBaseName = siteName;
		if (!preferredSlug) {
			slugBaseName = getDefaultSiteNameFromBlueprint(
				resolvedBlueprint.blueprint,
				siteName
			);
			displayName = getSiteNameWithCreationTimeIfDuplicate(
				slugBaseName,
				getStoredSites().map((site) => site.metadata.name),
				new Date()
			);
		}
		siteSlug = getAvailableSiteSlug(slugBaseName);
		const newSiteInfo: SiteInfo = {
			slug: siteSlug,
			originalUrlParams: newSiteUrlParams,
			metadata: {
				name: displayName,
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
		await serializeSiteUpdate(siteSlug, async () => {
			dispatch(sitesSlice.actions.addSite(newSiteInfo));
			dispatch(sitesSlice.actions.setFirstTemporarySiteCreated());
		});
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
}

/** Controls the lifecycle assigned to a newly stored Playground. */
type StoredSiteSpecOptions = {
	/** Whether the stored site is an autosave or an explicit user save. */
	persistence?: SitePersistence;
};

/**
 * Creates an OPFS-backed site after its setup and slug are fully resolved.
 *
 * This intentionally overlaps with `setTemporarySiteSpec`: both capture the
 * setup URL, resolve the Blueprint, and derive the runtime configuration.
 * Stored sites diverge after that by writing OPFS metadata immediately, keeping
 * more than one site record, and marking the first file sync as pending. Boot
 * then uses the same setup URL to install WordPress in MEMFS before copying the
 * initialized files into OPFS.
 *
 * Slug allocation and metadata creation share a browser-wide creation lock, so
 * another tab cannot claim the selected path between the durable check and the
 * first write. Bundle resources are copied only after that check succeeds.
 */
export function setStoredSiteSpec(
	siteName: string,
	playgroundUrlWithQueryApiArgs: URL,
	preferredSlug?: string,
	options: StoredSiteSpecOptions = {}
) {
	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		const originalUrlParams = getOriginalUrlParams(
			playgroundUrlWithQueryApiArgs
		);

		const resolvedBlueprint = await resolveSiteBlueprintFromUrl(
			playgroundUrlWithQueryApiArgs
		);
		/** Allocates and commits the site while the creation lock is held. */
		const createStoredSite = () =>
			serializeStoredSiteCreation(async () => {
				const now = Date.now();
				const sitesBySlug = new Map(
					[
						...((await opfsSiteStorage?.list()) ?? []),
						...selectAllSites(getState()),
					].map((site) => [site.slug, site])
				);
				const sites = Array.from(sitesBySlug.values());
				let displayName = siteName;
				let slugBaseName = siteName;
				if (!preferredSlug) {
					slugBaseName = getDefaultSiteNameFromBlueprint(
						resolvedBlueprint.blueprint,
						siteName
					);
					displayName = getSiteNameWithCreationTimeIfDuplicate(
						slugBaseName,
						sites.map((site) => site.metadata.name),
						new Date(now)
					);
				}
				const siteSlug = getUniqueSiteSlug(
					preferredSlug || deriveSlugFromSiteName(slugBaseName),
					{ unavailableSlugs: sites.map((site) => site.slug) }
				);
				const runtimeConfiguration = (await resolveRuntimeConfiguration(
					resolvedBlueprint.blueprint
				))!;
				let originalBlueprintSource = resolvedBlueprint.source!;
				const blueprintBundle = isTraversableFilesystemBackend(
					resolvedBlueprint.blueprint
				)
					? resolvedBlueprint.blueprint
					: undefined;
				if (blueprintBundle) {
					originalBlueprintSource = {
						type: 'opfs-site',
					};
				}
				const newSiteInfo: SiteInfo = {
					slug: siteSlug,
					originalUrlParams,
					metadata: {
						name: displayName,
						id: crypto.randomUUID(),
						whenCreated: now,
						whenLastUsed: now,
						persistence: options.persistence ?? 'explicit',
						storage: 'opfs' as const,
						initialOpfsSyncPending: true,
						sourceSetupUrlFingerprint:
							getAutosaveFingerprintFromURL(
								playgroundUrlWithQueryApiArgs
							),
						originalBlueprint: resolvedBlueprint.blueprint,
						originalBlueprintSource,
						runtimeConfiguration,
					},
				};

				await serializeSiteUpdate(siteSlug, async () => {
					if (
						selectSiteBySlug(getState(), siteSlug) ||
						(await opfsSiteStorage?.read(siteSlug))
					) {
						throw new Error(`Site already exists: ${siteSlug}`);
					}
					if (!opfsSiteStorage) {
						throw new Error(
							'Cannot add a saved Playground because browser storage is not available.'
						);
					}
					await opfsSiteStorage.removeUnownedSiteDirectory(siteSlug);
					if (blueprintBundle) {
						const persistedBundle = await persistBlueprintBundle(
							siteSlug,
							blueprintBundle
						);
						newSiteInfo.metadata.originalBlueprint =
							persistedBundle.backend;
						newSiteInfo.metadata.originalBlueprintSource = {
							type: 'opfs-site',
							directory: persistedBundle.directory,
						};
					}
					await addSiteWhileLocked(
						newSiteInfo,
						dispatch,
						getState,
						true
					);
				});
				return newSiteInfo;
			});
		return options.persistence === 'autosave'
			? serializeAutosaveLifecycle(createStoredSite)
			: createStoredSite();
	};
}

/**
 * Deletes a staged bundle after authoritative metadata proves it is inactive.
 *
 * Pending-reset metadata may already select the staged directory even when a
 * later transaction step failed. Keep that version so boot recovery still has
 * every resource referenced by the durable setup.
 */
async function deleteBlueprintBundleVersionIfUnselected(
	siteSlug: string,
	persistedBundle: PersistedBlueprintBundle,
	authoritativeSite: SiteInfo | undefined
): Promise<void> {
	const selectedSource = authoritativeSite?.metadata.originalBlueprintSource;
	if (
		selectedSource?.type === 'opfs-site' &&
		selectedSource.directory === persistedBundle.directory
	) {
		return;
	}
	try {
		await deletePersistedBlueprintBundleVersion(
			siteSlug,
			persistedBundle.directory,
			persistedBundle.sitePath ??
				(authoritativeSite?.metadata as any)?.[legacyOpfsPathSymbol]
		);
	} catch (error) {
		// Cleanup must not hide the transaction error or stale-owner result that
		// made this version inactive. A later site deletion removes all versions.
		logger.error(
			`Could not remove inactive Blueprint bundle for ${siteSlug}.`,
			error
		);
	}
}

/**
 * Replaces an autosaved Playground's WordPress files with files from a new setup.
 *
 * This is used after the user clicks "Apply Settings & Recreate Playground"
 * in the autosaved settings form. The site keeps the same slug and name in the
 * sidebar, but the old WordPress directory is deleted and the next boot
 * installs WordPress from `playgroundUrlWithQueryApiArgs`.
 * `prepareForWordPressFileReset` can unmount the current OPFS device after the
 * replacement has won the site queue but before any WordPress files are deleted.
 *
 * Callers must not use this for edits that can keep the existing files, such as
 * changing PHP version or networking. Those should update site metadata and
 * reboot. Longer term, the Dock UI should create a new Playground for setup
 * changes and leave the previous Playground untouched. Until that UX exists,
 * this function writes `opfsSiteRemovalPending` so a reload can finish deleting old
 * WordPress files if the tab closes during the deletion.
 */
export function resetAutosavedSiteSpec(
	siteSlug: string,
	playgroundUrlWithQueryApiArgs: URL,
	prepareForWordPressFileReset?: () => Promise<
		SiteRuntimeSuspension | undefined
	>
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
				`Cannot reset ${siteSlug}; only autosaved Playgrounds can replace their stored files.`
			);
		}
		const expectedSetup: SiteSetupRevision = {
			id: site.metadata.id,
			whenCreated: site.metadata.whenCreated,
			runtimeConfiguration: site.metadata.runtimeConfiguration,
			sourceSetupUrlFingerprint: site.metadata.sourceSetupUrlFingerprint,
		};

		const resolvedBlueprint = await resolveSiteBlueprintFromUrl(
			playgroundUrlWithQueryApiArgs
		);
		const runtimeConfiguration = (await resolveRuntimeConfiguration(
			resolvedBlueprint.blueprint
		))!;
		let originalBlueprintSource = resolvedBlueprint.source!;
		let blueprintBundle: TraversableFilesystemBackend | undefined;
		if (isTraversableFilesystemBackend(resolvedBlueprint.blueprint)) {
			blueprintBundle = resolvedBlueprint.blueprint;
			originalBlueprintSource = {
				type: 'opfs-site',
			};
		}
		const now = Date.now();
		const changes = {
			loadedFromStorage: false,
			originalUrlParams: getOriginalUrlParams(
				playgroundUrlWithQueryApiArgs
			),
			metadata: {
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
				sourceSetupUrlFingerprint: getAutosaveFingerprintFromURL(
					playgroundUrlWithQueryApiArgs
				),
				originalBlueprint: resolvedBlueprint.blueprint,
				originalBlueprintSource,
				runtimeConfiguration,
			},
		};

		// Resolve the new setup before deleting the old WordPress files so a
		// broken Blueprint URL does not destroy the existing autosave. Keep
		// Redux unchanged until the old files are gone; changing `whenCreated`
		// remounts the iframe, and the old OPFS mount can still write files
		// back into this site's OPFS directory until deletion finishes.
		const replacedCurrentSetup = await dispatch(
			replaceAutosavedSiteSetup({
				slug: siteSlug,
				expectedSetup,
				changes,
				blueprintBundle,
				prepareForWordPressFileReset,
			})
		);
		if (!replacedCurrentSetup) {
			throw new Error(
				`Cannot reset ${siteSlug}; its setup changed while the new Blueprint was loading.`
			);
		}
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
			resolvedBlueprint.blueprint as any,
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
	 * Crash-recovery marker for replacing autosaved WordPress files.
	 *
	 * The current autosaved settings/Blueprint flows can keep the same slug
	 * while changing the setup. They write new setup metadata before deleting
	 * old WordPress files, so a browser crash can otherwise leave old files
	 * paired with new metadata. When this flag is present, boot must finish
	 * deleting the old files before it decides whether to mount OPFS or install
	 * WordPress from the new setup.
	 */
	opfsSiteRemovalPending?: boolean;
	/**
	 * PHP constants discovered from the running Playground and persisted so
	 * they can be replayed after reload without changing the live boot config.
	 */
	playgroundDefinedConstants?: RuntimeConfiguration['constants'];

	// @TODO: Accept any string as a php version?
	runtimeConfiguration: RuntimeConfiguration;
	originalBlueprint: unknown;
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

/**
 * Returns storage-backed Playgrounds, including autosaves, in recency order.
 * Temporary Playgrounds remain outside this list because they are only
 * available for the current session.
 */
export const selectSortedStoredSites = createSelector(
	[selectSortedSites],
	(sites: SiteInfo[]) => sites.filter(isStoredSite)
);

export const selectTemporarySite = createSelector(
	[selectAllSites],
	(sites: SiteInfo[]) => {
		return sites.find(isTemporarySite);
	}
);

export const selectTemporarySites = createSelector(
	[selectAllSites],
	(sites: SiteInfo[]) => {
		return sites.filter(isTemporarySite);
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
		((activeSite && isStoredSite(activeSite)) || firstTemporarySiteCreated)
);

export default sitesSlice.reducer;
