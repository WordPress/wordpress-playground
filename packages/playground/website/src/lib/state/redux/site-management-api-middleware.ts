import { useMemo } from 'react';
import { useStore } from 'react-redux';
import { createListenerMiddleware } from '@reduxjs/toolkit';
import type { PlaygroundReduxState, PlaygroundDispatch } from './store';
import {
	selectActiveSite,
	selectActiveSiteError,
	selectActiveSiteErrorDetails,
	setActiveSite,
	useAppDispatch,
} from './store';
import type { SerializedSiteErrorDetails, SiteError } from './slice-ui';
import { setActiveSiteError, setSiteImportProgress } from './slice-ui';
import {
	addClientInfo,
	removeClientInfo,
	selectClientBySiteSlug,
	selectClientInfoBySiteSlug,
	updateClientInfo,
} from './slice-clients';
import {
	selectAllSites,
	selectSiteBySlug,
	setOPFSSitesLoadingState,
	updateSite,
	updateSiteMetadata,
	removeSite,
	pruneAutosavedSites,
	preserveSite,
	setTemporarySiteSpec,
	setStoredSiteSpec,
	deriveSiteNameFromSlug,
	getSitePublicPersistence,
	isAutosavedSite,
	isStoredSite,
	type SiteInfo,
	type SitePersistence,
	type SiteStorageType,
} from './slice-sites';
import { randomSiteName } from './random-site-name';
import { persistTemporarySite } from './persist-temporary-site';
import type { PlaygroundClient } from '@wp-playground/remote';
import type { AllPHPVersion } from '@php-wasm/universal';
import { opfsSiteStorage } from '../opfs/opfs-site-storage';
import { getSetupUrlFromUrl } from '../playground-identity';
import { importWordPressFiles } from '@wp-playground/client';
import { registerSiteFirstBootInitializer } from './site-first-boot-initializer';
import {
	ProgressTracker,
	type ProgressDetails,
	type ProgressTrackerEvent,
} from '@php-wasm/progress';
import { logger } from '@php-wasm/logger';
import { PlaygroundRoute, redirectTo } from '../url/router';

export interface SiteSettings {
	phpVersion?: AllPHPVersion;
	wpVersion?: string;
	networking?: boolean;
	language?: string;
	multisite?: boolean;
}

type PublicSiteStorageType = Exclude<SiteStorageType, 'none'> | 'temporary';
type SaveSiteResult = { slug: string; storage: SiteStorageType };
type ZipImportProgress = ProgressDetails;
type ZipImportProgressCallback = (progress: ZipImportProgress) => void;
type ZipImportOptions = {
	onProgress?: ZipImportProgressCallback;
	onPlaygroundLoaded?: (storage: 'opfs' | 'temporary') => void;
};

const ZIP_INSTALL_PROGRESS_PERCENT = 85;
const ZIP_STORAGE_PROGRESS_PERCENT = 100 - ZIP_INSTALL_PROGRESS_PERCENT;

/**
 * Tracks the operation shared by concurrent autosave calls for one site.
 *
 * The promise covers persistence, routing, and pruning. Routing requests remain
 * mutable until the operation completes because a later caller may require a
 * URL update while awaiting the same promise.
 */
type AutosaveInProgress = {
	promise: Promise<SaveSiteResult>;
	requests: {
		urlUpdateRequested: boolean;
	};
};

/**
 * Coordinates autosaves created for one Redux store.
 *
 * Filesystem persistence is shared by site slug. Pruning reads the store's
 * complete site list, so active calls contribute exclusions to one shared
 * pruning operation.
 */
type AutosaveCoordinator = {
	autosavesBySiteSlug: Map<string, AutosaveInProgress>;
	activePruningExclusions: Set<ReadonlySet<string>>;
	pruneInProgress?: Promise<void>;
	activePruneAbortController?: AbortController;
};

// The window API and React hooks create separate API objects for the same Redux
// store. Key by dispatch so those objects share per-site persistence and one
// store-wide pruning operation without mixing stores.
const autosaveCoordinatorsByDispatch = new WeakMap<
	PlaygroundDispatch,
	AutosaveCoordinator
>();

/**
 * API for listing, renaming, saving, and opening Playground
 * sites. Used by the MCP bridge, the `window.playgroundSites`
 * DevTools global, and UI components.
 */
export type PlaygroundSitesAPI = ReturnType<typeof createSitesAPI>;

export const siteManagementMiddleware = createListenerMiddleware();

export const startListening = siteManagementMiddleware.startListening.withTypes<
	PlaygroundReduxState,
	PlaygroundDispatch
>();

declare global {
	interface Window {
		playgroundSites?: PlaygroundSitesAPI;
	}
}

function siteErrorMessage(
	error: SiteError,
	details: SerializedSiteErrorDetails | undefined
): string {
	if (typeof details === 'string') {
		return details;
	}
	return details?.message ?? error;
}

export function createSitesAPI(
	getState: () => PlaygroundReduxState,
	dispatch: PlaygroundDispatch
) {
	let autosaveCoordinator = autosaveCoordinatorsByDispatch.get(dispatch);
	if (!autosaveCoordinator) {
		autosaveCoordinator = {
			autosavesBySiteSlug: new Map(),
			activePruningExclusions: new Set(),
		};
		autosaveCoordinatorsByDispatch.set(dispatch, autosaveCoordinator);
	}
	const coordinator = autosaveCoordinator;
	const autosavesInProgressBySiteSlug = coordinator.autosavesBySiteSlug;
	const api = {
		/**
		 * Lists all known sites.
		 *
		 * @returns List of site info objects.
		 */
		list(): Array<{
			slug: string;
			name: string;
			storage: PublicSiteStorageType;
			persistence?: SitePersistence;
			isActive: boolean;
		}> {
			const state = getState();
			const allSites = selectAllSites(state);
			const active = selectActiveSite(state);
			// Keep the Redux-only "none" sentinel out of the public API;
			// callers should see the user-facing "temporary" storage state.
			return allSites.map((s) => ({
				slug: s.slug,
				name: s.metadata.name,
				storage:
					s.metadata.storage === 'none'
						? 'temporary'
						: s.metadata.storage,
				persistence: getSitePublicPersistence(s),
				isActive: s.slug === active?.slug,
			}));
		},

		/**
		 * Returns the PlaygroundClient for the active site.
		 *
		 * @returns The client, or `undefined` if not yet booted.
		 * @throws When no site is selected.
		 */
		getClient(): PlaygroundClient | undefined {
			const site = selectActiveSite(getState());
			if (!site) {
				throw new Error('No active site selected');
			}
			return selectClientBySiteSlug(getState(), site.slug);
		},

		/**
		 * Resolves once the active site is fully booted and its
		 * PlaygroundClient is ready for API calls. Mirrors the
		 * `isReady()` method on the PlaygroundClient itself.
		 *
		 * @throws When no site is selected or the site fails to boot.
		 */
		async isReady(): Promise<void> {
			// Wait until the store reaches a "settled" state for the active
			// site: either a client has been added for it, or boot failed
			// with an error. This also covers the early window after
			// `window.playgroundSites` is exposed but before
			// `EnsurePlaygroundSiteIsSelected` has had a chance to set an
			// active site — we simply wait for one to appear.
			const isSettled = (state: PlaygroundReduxState) => {
				const site = selectActiveSite(state);
				if (!site) {
					return false;
				}
				if (selectActiveSiteError(state)) {
					return true;
				}
				return Boolean(selectClientBySiteSlug(state, site.slug));
			};

			let settledState = getState();
			if (!isSettled(settledState)) {
				settledState = await new Promise<PlaygroundReduxState>(
					(resolve) => {
						const unsubscribe = startListening({
							predicate: (_action, currentState) =>
								isSettled(currentState),
							effect: (_action, listenerApi) => {
								unsubscribe();
								resolve(listenerApi.getState());
							},
						});
					}
				);
			}

			const error = selectActiveSiteError(settledState);
			if (error) {
				throw new Error(
					siteErrorMessage(
						error,
						selectActiveSiteErrorDetails(settledState)
					)
				);
			}
			const site = selectActiveSite(settledState)!;
			const client = selectClientBySiteSlug(settledState, site.slug);
			if (!client) {
				throw new Error('Client unavailable after boot.');
			}
			await client.isReady();
		},

		/**
		 * Renames a stored site.
		 *
		 * Defaults to the active site for callers that rename the current
		 * Playground. UI that opens a rename modal from a site list must pass
		 * the target slug because the listed site may not be active.
		 *
		 * @param newName The new display name.
		 * @param siteSlug Optional slug. Uses the active site when omitted.
		 * @throws When no site is selected, the slug is unknown, or the site is
		 *   temporary.
		 */
		async rename(newName: string, siteSlug?: string): Promise<void> {
			const site = siteSlug
				? selectSiteBySlug(getState(), siteSlug)
				: selectActiveSite(getState());
			if (!site) {
				throw new Error(
					siteSlug
						? `Site not found: ${siteSlug}`
						: 'No site selected'
				);
			}
			if (site.metadata.storage === 'none') {
				throw new Error(
					'Cannot rename a temporary site. Save it first.'
				);
			}
			await dispatch(
				updateSiteMetadata({
					slug: site.slug,
					changes: { name: newName },
				})
			);
		},

		/**
		 * Saves the active temporary or autosaved Playground in browser storage.
		 *
		 * Temporary sites are persisted to OPFS. Existing autosaves are kept in
		 * their current backend and marked as explicitly saved.
		 *
		 * @param name Optional display name for the saved site.
		 * @returns The site's slug and storage type.
		 * @throws When no site is selected or saving fails.
		 */
		async saveInBrowser(name?: string): Promise<SaveSiteResult> {
			const site = selectActiveSite(getState());
			if (!site) {
				throw new Error('No active site selected');
			}
			if (site.metadata.storage !== 'none') {
				if (isAutosavedSite(site)) {
					await api.keep(site.slug, name);
				}
				return { slug: site.slug, storage: site.metadata.storage };
			}
			await dispatch(
				persistTemporarySite(site.slug, 'opfs', {
					siteName: name,
					skipRenameModal: true,
					updateUrl: true,
				})
			);
			const updatedSite = selectSiteBySlug(getState(), site.slug);
			const storage = updatedSite?.metadata.storage ?? 'none';
			return { slug: site.slug, storage };
		},

		/**
		 * Autosaves a temporary Playground into browser storage.
		 *
		 * Autosave keeps the current browser URL unchanged unless the caller
		 * asks to route to the new stored site. Concurrent requests for one site
		 * share the filesystem copy and metadata update. Routing runs when any caller
		 * requests it. Pruning is serialized across the store and protects the slugs
		 * requested by every concurrent autosave.
		 *
		 * @param siteSlug Optional slug. Uses the active site when omitted.
		 * @param options Optional URL update and pruning behavior.
		 * @returns The site's slug and storage type.
		 */
		async autosaveTemporarySite(
			siteSlug?: string,
			options: {
				updateUrl?: boolean;
				excludeFromPruning?: string[];
			} = {}
		): Promise<SaveSiteResult> {
			const site = siteSlug
				? selectSiteBySlug(getState(), siteSlug)
				: selectActiveSite(getState());
			if (!site) {
				throw new Error('No site selected');
			}
			let autosaveInProgress = autosavesInProgressBySiteSlug.get(
				site.slug
			);
			// A stored site with no autosave in progress has no work left to complete.
			if (!autosaveInProgress && isStoredSite(site)) {
				return { slug: site.slug, storage: site.metadata.storage };
			}

			// Each pruning pass considers every autosaved site in the Redux store.
			// Keep this call's exclusions visible to the shared pass until it finishes.
			const pruningExclusions = new Set([
				site.slug,
				...(options.excludeFromPruning ?? []),
			]);
			coordinator.activePruningExclusions.add(pruningExclusions);
			// A running pass selected its candidates from an older snapshot. Stop it
			// before its next deletion so the new exclusions can be applied.
			coordinator.activePruneAbortController?.abort();

			try {
				// Only one filesystem copy may target a site's OPFS destination.
				// Concurrent autosaveTemporarySite() invocations for that slug share the
				// copy and combine whether the stored site's URL must be opened.
				if (!autosaveInProgress) {
					const requests: AutosaveInProgress['requests'] = {
						urlUpdateRequested: false,
					};
					autosaveInProgress = {
						promise: runSharedAutosave(site, requests),
						requests,
					};
					autosavesInProgressBySiteSlug.set(
						site.slug,
						autosaveInProgress
					);
				}

				autosaveInProgress.requests.urlUpdateRequested ||=
					options.updateUrl ?? false;
				return await autosaveInProgress.promise;
			} finally {
				coordinator.activePruningExclusions.delete(pruningExclusions);
			}

			/**
			 * Persists one site and completes its shared routing and pruning work.
			 *
			 * Concurrent filesystem copies would target the same OPFS destination and
			 * race its mount and metadata updates. Routing remains specific to this site;
			 * pruning joins the operation shared by the Redux store.
			 */
			async function runSharedAutosave(
				siteToAutosave: SiteInfo,
				requests: AutosaveInProgress['requests']
			): Promise<SaveSiteResult> {
				// The promise must be present in the per-site map before persistence can
				// dispatch actions that start another autosave.
				await Promise.resolve();

				try {
					await dispatch(
						persistTemporarySite(siteToAutosave.slug, 'opfs', {
							skipRenameModal: true,
							persistence: 'autosave',
							// The shared operation combines routing requests separately.
							updateUrl: false,
						})
					);
					const updatedSite = selectSiteBySlug(
						getState(),
						siteToAutosave.slug
					);
					const storage = updatedSite?.metadata.storage;
					if (!updatedSite || !isStoredSite(updatedSite)) {
						throw new Error(
							`Site ${siteToAutosave.slug} was not persisted (storage: ${storage}).`
						);
					}

					let urlWasUpdated = false;
					if (requests.urlUpdateRequested) {
						redirectTo(PlaygroundRoute.site(updatedSite));
						urlWasUpdated = true;
					}
					await runStoreWidePruning();
					if (requests.urlUpdateRequested && !urlWasUpdated) {
						// The URL request arrived while pruning was pending.
						redirectTo(PlaygroundRoute.site(updatedSite));
					}
					return { slug: siteToAutosave.slug, storage };
				} finally {
					// Only remove the entry owned by this workflow. A replacement for the
					// same slug must remain registered.
					if (
						autosavesInProgressBySiteSlug.get(siteToAutosave.slug)
							?.requests === requests
					) {
						autosavesInProgressBySiteSlug.delete(
							siteToAutosave.slug
						);
					}
				}
			}

			/**
			 * Runs the pruning operation shared by active autosaves in this Redux store.
			 *
			 * Each pass receives an immutable exclusion snapshot. Registering another
			 * autosave aborts an active pass between deletions, then the loop starts a
			 * replacement pass containing all exclusions that are still active.
			 */
			async function runStoreWidePruning(): Promise<void> {
				let pruning = coordinator.pruneInProgress;
				if (!pruning) {
					pruning = runPruningPasses();
					coordinator.pruneInProgress = pruning;
				}
				await pruning;

				async function runPruningPasses(): Promise<void> {
					// The shared promise must be published before pruning can dispatch work
					// that starts another autosave.
					await Promise.resolve();
					try {
						let passWasAborted: boolean;
						do {
							const abortController = new AbortController();
							coordinator.activePruneAbortController =
								abortController;
							try {
								await dispatch(
									pruneAutosavedSites({
										excludeSlugs: [
											...getActivePruningExclusions(),
										],
										signal: abortController.signal,
									})
								);
							} finally {
								if (
									coordinator.activePruneAbortController ===
									abortController
								) {
									coordinator.activePruneAbortController =
										undefined;
								}
							}
							passWasAborted = abortController.signal.aborted;
						} while (passWasAborted);
					} finally {
						if (coordinator.pruneInProgress === pruning) {
							coordinator.pruneInProgress = undefined;
						}
					}
				}
			}

			/**
			 * Returns the union of exclusions owned by active autosave calls.
			 */
			function getActivePruningExclusions(): Set<string> {
				const slugs = new Set<string>();
				for (const exclusions of coordinator.activePruningExclusions) {
					for (const slug of exclusions) {
						slugs.add(slug);
					}
				}
				return slugs;
			}
		},

		/**
		 * Keeps an autosaved Playground as a saved Playground.
		 *
		 * This is a metadata-only lifecycle change. It turns an autosaved stored
		 * Playground into an explicit save so autosave pruning and restore prompts
		 * no longer treat it as disposable. It may rename the Playground when the
		 * caller provides a name, but it does not copy files, change the storage
		 * backend, or reboot it. Already-explicit stored Playgrounds are left
		 * explicit.
		 *
		 * @param siteSlug Optional slug. Uses the active site when omitted.
		 * @param name Optional display name to apply before keeping the site.
		 * @throws When no site is selected, the slug is unknown, or the site is
		 *   temporary.
		 */
		async keep(siteSlug?: string, name?: string): Promise<void> {
			const site = siteSlug
				? selectSiteBySlug(getState(), siteSlug)
				: selectActiveSite(getState());
			if (!site) {
				throw new Error('No site selected');
			}
			if (site.metadata.storage === 'none') {
				throw new Error(
					'Cannot keep a temporary site. Autosave it first.'
				);
			}
			await updateSiteNameIfProvided(dispatch, site, name);
			// "Keeping" an autosave only changes lifecycle metadata. The
			// filesystem stays in the same storage backend.
			await dispatch(preserveSite(site.slug));
		},

		/**
		 * Saves the active temporary or autosaved Playground to a local directory.
		 *
		 * Autosaved browser Playgrounds already have durable metadata, but their
		 * files still need to be copied from the running iframe into the picked
		 * local directory.
		 *
		 * @param name Optional display name for the saved site.
		 * @param localFsHandle Directory handle. When omitted the
		 *   browser prompts the user to pick one.
		 * @returns The site's slug and storage type.
		 * @throws When no site is selected or saving fails.
		 */
		async saveToLocalFileSystem(
			name?: string,
			localFsHandle?: FileSystemDirectoryHandle
		): Promise<SaveSiteResult> {
			const site = selectActiveSite(getState());
			if (!site) {
				throw new Error('No active site selected');
			}
			if (site.metadata.storage !== 'none') {
				if (site.metadata.storage === 'local-fs') {
					await updateSiteNameIfProvided(dispatch, site, name);
					if (isAutosavedSite(site)) {
						await dispatch(preserveSite(site.slug));
					}
					return { slug: site.slug, storage: site.metadata.storage };
				}
				if (!isAutosavedSite(site)) {
					return { slug: site.slug, storage: site.metadata.storage };
				}
			}
			await dispatch(
				persistTemporarySite(site.slug, 'local-fs', {
					siteName: name,
					localFsHandle,
					skipRenameModal: true,
					updateUrl: true,
				})
			);
			const updatedSite = selectSiteBySlug(getState(), site.slug);
			const storage = updatedSite?.metadata.storage;
			if (storage !== 'opfs' && storage !== 'local-fs') {
				throw new Error(
					`Site ${site.slug} was not persisted (storage: ${storage}).`
				);
			}
			return { slug: site.slug, storage };
		},

		/**
		 * Changes the PHP version for the active site and reboots it.
		 *
		 * @param version The PHP version to use (e.g. `"8.4"`).
		 * @throws When no site is selected or the site is temporary.
		 */
		async setPhpVersion(version: AllPHPVersion): Promise<void> {
			const site = selectActiveSite(getState());
			if (!site) {
				throw new Error('No active site selected');
			}
			if (site.metadata.storage === 'none') {
				throw new Error(
					'Cannot update settings on a temporary site. Save it first.'
				);
			}
			await dispatch(
				updateSite({
					slug: site.slug,
					changes: {
						urlToRestoreAfterRuntimeSettingsChange:
							selectClientInfoBySiteSlug(getState(), site.slug)
								?.url,
						metadata: {
							runtimeConfiguration: {
								phpVersion: version,
							},
						},
					},
				})
			);
		},

		/**
		 * Enables or disables network access for the active site
		 * and reboots it.
		 *
		 * @param enabled Whether networking should be on.
		 * @throws When no site is selected or the site is temporary.
		 */
		async setNetworking(enabled: boolean): Promise<void> {
			const site = selectActiveSite(getState());
			if (!site) {
				throw new Error('No active site selected');
			}
			if (site.metadata.storage === 'none') {
				throw new Error(
					'Cannot update settings on a temporary site. Save it first.'
				);
			}
			await dispatch(
				updateSite({
					slug: site.slug,
					changes: {
						urlToRestoreAfterRuntimeSettingsChange:
							selectClientInfoBySiteSlug(getState(), site.slug)
								?.url,
						metadata: {
							runtimeConfiguration: {
								networking: enabled,
							},
						},
					},
				})
			);
		},

		/**
		 * Applies the runtime settings that can change without replacing WordPress.
		 * When the settings already match, reloads the current WordPress page.
		 *
		 * PHP and networking share one metadata write so changing both cannot boot an
		 * intermediate runtime and then immediately tear it down for the second change.
		 */
		async updateRuntimeSettings(settings: {
			phpVersion: AllPHPVersion;
			networking: boolean;
		}): Promise<void> {
			const site = selectActiveSite(getState());
			if (!site) {
				throw new Error('No active site selected');
			}
			if (site.metadata.storage === 'none') {
				throw new Error(
					'Cannot update settings on a temporary site. Save it first.'
				);
			}
			const currentRuntimeConfiguration =
				site.metadata.runtimeConfiguration;
			if (
				currentRuntimeConfiguration.phpVersion ===
					settings.phpVersion &&
				currentRuntimeConfiguration.networking === settings.networking
			) {
				const client = selectClientBySiteSlug(getState(), site.slug);
				if (!client) {
					throw new Error(
						'Cannot reload a Playground that is not running.'
					);
				}
				await client.goTo(await client.getCurrentURL());
				return;
			}
			await dispatch(
				updateSite({
					slug: site.slug,
					changes: {
						urlToRestoreAfterRuntimeSettingsChange:
							selectClientInfoBySiteSlug(getState(), site.slug)
								?.url,
						metadata: {
							runtimeConfiguration: {
								phpVersion: settings.phpVersion,
								networking: settings.networking,
							},
						},
					},
				})
			);
		},

		/**
		 * Deletes a saved site by slug.
		 *
		 * @param siteSlug The slug of the site to delete.
		 * @throws When the site is not found, the site is temporary, or its
		 * storage cannot be deleted.
		 */
		async delete(siteSlug: string): Promise<void> {
			const site = selectSiteBySlug(getState(), siteSlug);
			if (!site) {
				throw new Error(`Site not found: ${siteSlug}`);
			}
			if (site.metadata.storage === 'none') {
				throw new Error(
					'Cannot delete a temporary site. It will be reset on the next page load.'
				);
			}
			await dispatch(removeSite(siteSlug));
		},

		/**
		 * Switches to a different site and boots it.
		 *
		 * @param siteSlug The slug of the site to activate.
		 * @param options Optional activation behavior.
		 * @throws When the site is not found or fails to boot.
		 */
		async setActiveSite(
			siteSlug: string,
			options: { updateUrl?: boolean } = {}
		): Promise<void> {
			const state = getState();
			const site = selectSiteBySlug(state, siteSlug);
			if (!site) {
				throw new Error(`Site not found: ${siteSlug}`);
			}
			// If the requested site is already active, avoid registering a
			// listener that will never fire. The underlying setActiveSite
			// thunk short-circuits in this case, so we can safely return.
			const activeSite = selectActiveSite(state);
			if (activeSite?.slug === siteSlug) {
				return;
			}
			if (selectClientInfoBySiteSlug(state, siteSlug)) {
				// Retained temporary or syncing viewports already have a running
				// client, so activation does not emit addClientInfo again.
				await dispatch(setActiveSite(siteSlug, options));
				return;
			}
			const bootPromise = new Promise<void>((resolve, reject) => {
				const unsubscribe = startListening({
					predicate: (action) =>
						(addClientInfo.match(action) &&
							action.payload.siteSlug === siteSlug) ||
						setActiveSiteError.match(action),
					effect: (action) => {
						unsubscribe();
						if (setActiveSiteError.match(action)) {
							reject(
								new Error(
									siteErrorMessage(
										action.payload.error,
										action.payload.details
									)
								)
							);
						} else {
							resolve();
						}
					},
				});
			});
			dispatch(setActiveSite(siteSlug, options));
			await bootPromise;
		},

		/**
		 * Creates a new temporary site and boots it.
		 *
		 * @param requestedSiteSlug Optional slug hint. When omitted, the
		 *   Blueprint title becomes the site name if available; otherwise a
		 *   random name is generated.
		 * @param settings Optional site settings.
		 * @returns The new site's slug.
		 */
		async createNewTemporarySite(
			requestedSiteSlug?: string,
			settings?: SiteSettings
		): Promise<string> {
			return await createTemporarySite(requestedSiteSlug, settings);
		},

		/**
		 * Creates a new browser-stored site and boots it.
		 *
		 * The site starts as an explicit save unless the caller marks it as an
		 * autosave. First boot creates the WordPress files from the setup URL,
		 * then stores that initialized filesystem in OPFS for later boots.
		 *
		 * @param requestedSiteSlug Optional slug hint. When omitted, the
		 *   Blueprint title becomes the site name if available; otherwise a
		 *   random name is generated.
		 * @param settings Optional site settings.
		 * @param options Optional persistence, routing, and pruning behavior.
		 * @returns The new site's slug.
		 */
		async createNewSavedSite(
			requestedSiteSlug?: string,
			settings?: SiteSettings,
			options: {
				persistence?: SitePersistence;
				updateUrl?: boolean;
				excludeFromPruning?: string[];
			} = {}
		): Promise<string> {
			return await createSavedSite(requestedSiteSlug, settings, options);
		},

		/**
		 * Creates an autosaved site from a Playground ZIP and waits until its
		 * imported filesystem is safely stored. The import runs against first-boot
		 * MEMFS before the initial OPFS copy, avoiding an empty-site persistence pass.
		 *
		 * @param wordPressFilesZip Playground ZIP export.
		 * @param options Import lifecycle callbacks. Passing a bare progress
		 *   callback remains supported.
		 * @returns The new site's slug.
		 */
		async createNewSiteFromZip(
			wordPressFilesZip: File,
			options: ZipImportOptions | ZipImportProgressCallback = {}
		): Promise<string> {
			const callbacks: ZipImportOptions =
				typeof options === 'function'
					? { onProgress: options }
					: options;
			const { onProgress, onPlaygroundLoaded } = callbacks;
			dispatch(
				setSiteImportProgress({
					caption: 'Starting import',
					progress: 0,
				})
			);
			try {
				const tracker = new ProgressTracker();
				const importWeight = opfsSiteStorage
					? ZIP_INSTALL_PROGRESS_PERCENT / 100
					: 1;
				tracker.addEventListener(
					'progress',
					(event: ProgressTrackerEvent) => {
						const progress = {
							caption: event.detail.caption,
							progress: event.detail.progress * importWeight,
						};
						dispatch(setSiteImportProgress(progress));
						onProgress?.(progress);
					}
				);
				const initialOpfsSyncProgress = opfsSiteStorage
					? new ProgressTracker({
							caption: 'Saving imported Playground',
						})
					: undefined;
				initialOpfsSyncProgress?.addEventListener(
					'progress',
					(event: ProgressTrackerEvent) => {
						onProgress?.({
							caption: event.detail.caption,
							progress:
								ZIP_INSTALL_PROGRESS_PERCENT +
								(event.detail.progress / 100) *
									ZIP_STORAGE_PROGRESS_PERCENT,
						});
					}
				);
				const initialize = async (playground: PlaygroundClient) => {
					await importWordPressFiles(
						playground,
						{ wordPressFilesZip },
						{ tracker }
					);
					await playground.goTo('/').catch((error) => {
						logger.error('Failed to refresh imported site', error);
						throw error;
					});
					// The imported page is ready. Reveal it while createSavedSite waits
					// for the initial OPFS autosave to finish.
					dispatch(setSiteImportProgress(undefined));
					onPlaygroundLoaded?.(
						opfsSiteStorage ? 'opfs' : 'temporary'
					);
				};
				if (!opfsSiteStorage) {
					return await createTemporarySite(
						undefined,
						undefined,
						initialize
					);
				}
				const siteSlug = await createSavedSite(
					undefined,
					undefined,
					{ persistence: 'autosave' },
					initialize,
					initialOpfsSyncProgress
				);
				onProgress?.({ caption: 'Import complete', progress: 100 });
				return siteSlug;
			} finally {
				dispatch(setSiteImportProgress(undefined));
			}
		},
	};

	async function createTemporarySite(
		requestedSiteSlug?: string,
		settings?: SiteSettings,
		initialize?: (playground: PlaygroundClient) => Promise<void>
	): Promise<string> {
		const siteName = requestedSiteSlug
			? deriveSiteNameFromSlug(requestedSiteSlug)
			: randomSiteName();
		const url = getSetupUrlForNewSite(settings, {
			baseUrl: new URL(window.location.href),
		});
		const newSiteInfo = await dispatch(
			setTemporarySiteSpec(siteName, url, requestedSiteSlug, {
				// ZIP initialization must run during a fresh boot, before WordPress
				// starts serving requests from the new filesystem.
				replaceExisting: Boolean(initialize),
			})
		);
		await activateNewSite(newSiteInfo.slug, initialize);
		return newSiteInfo.slug;
	}

	async function createSavedSite(
		requestedSiteSlug?: string,
		settings?: SiteSettings,
		options: {
			persistence?: SitePersistence;
			updateUrl?: boolean;
			excludeFromPruning?: string[];
		} = {},
		initialize?: (playground: PlaygroundClient) => Promise<void>,
		initialOpfsSyncProgress?: ProgressTracker
	): Promise<string> {
		if (!opfsSiteStorage) {
			throw new Error(
				'Cannot create a saved Playground because browser storage is not available.'
			);
		}
		const siteName = requestedSiteSlug
			? deriveSiteNameFromSlug(requestedSiteSlug)
			: randomSiteName();
		const url = getSetupUrlForNewSite(settings, {
			baseUrl: new URL(window.location.href),
			onlySetupParams: true,
		});
		const previousActiveSiteSlug = selectActiveSite(getState())?.slug;
		const newSiteInfo = await dispatch(
			setStoredSiteSpec(siteName, url, requestedSiteSlug, {
				persistence: options.persistence ?? 'explicit',
			})
		);
		try {
			await activateNewSite(newSiteInfo.slug, initialize, {
				updateUrl: options.updateUrl,
			});
			if (initialize) {
				await waitForInitialOpfsSync(
					newSiteInfo.slug,
					initialOpfsSyncProgress
				);
			}
		} catch (error) {
			if (initialize) {
				// A failed initializer or first OPFS copy cannot produce a reloadable
				// site. Remove it instead of retaining incomplete files and metadata.
				await dispatch(
					removeSite(newSiteInfo.slug, {
						replacementSiteSlug: previousActiveSiteSlug,
						updateUrl: options.updateUrl,
					})
				);
			}
			throw error;
		}
		await dispatch(
			pruneAutosavedSites({
				excludeSlugs: [
					newSiteInfo.slug,
					...(options.excludeFromPruning ?? []),
				],
			})
		);
		return newSiteInfo.slug;
	}

	async function activateNewSite(
		siteSlug: string,
		initialize?: (playground: PlaygroundClient) => Promise<void>,
		options: { updateUrl?: boolean } = {}
	) {
		const initialization = initialize
			? registerSiteFirstBootInitializer(siteSlug, initialize)
			: undefined;
		try {
			await api.setActiveSite(siteSlug, options);
			await initialization?.finished;
		} catch (error) {
			initialization?.cancel();
			throw error;
		}
	}

	async function waitForInitialOpfsSync(
		siteSlug: string,
		progress?: ProgressTracker
	) {
		const getSync = () =>
			selectClientInfoBySiteSlug(getState(), siteSlug)?.opfsSync;
		const reportProgress = () => {
			const currentSync = getSync();
			const syncProgress =
				currentSync?.status === 'syncing'
					? currentSync.progress
					: undefined;
			const completedFiles = syncProgress?.files ?? 0;
			const totalFiles = syncProgress?.total ?? 0;
			progress?.set(
				totalFiles > 0
					? Math.min(1, completedFiles / totalFiles) * 100
					: 0
			);
		};
		const sync = getSync();
		if (!sync) {
			const site = selectSiteBySlug(getState(), siteSlug);
			if (!site || site.metadata.initialOpfsSyncPending !== false) {
				throw new Error(
					'Unable to save the Playground because its initial storage sync did not complete.'
				);
			}
			progress?.finish();
			return;
		}
		if (sync.status === 'error') {
			throw new Error('Unable to save the Playground.');
		}
		reportProgress();

		await new Promise<void>((resolve, reject) => {
			const unsubscribe = startListening({
				predicate: (action) =>
					(updateClientInfo.match(action) &&
						action.payload.siteSlug === siteSlug) ||
					(removeClientInfo.match(action) &&
						action.payload === siteSlug),
				effect: (action) => {
					if (removeClientInfo.match(action)) {
						unsubscribe();
						reject(
							new Error(
								'Unable to save the Playground because its runtime stopped.'
							)
						);
						return;
					}
					const currentSync = getSync();
					if (currentSync?.status === 'syncing') {
						reportProgress();
						return;
					}
					unsubscribe();
					if (currentSync?.status === 'error') {
						reject(new Error('Unable to save the Playground.'));
					} else {
						progress?.finish();
						resolve();
					}
				},
			});
		});
	}
	return api;
}

/**
 * Applies a new display name before a metadata-only save transition.
 */
async function updateSiteNameIfProvided(
	dispatch: PlaygroundDispatch,
	site: SiteInfo,
	name?: string
) {
	const trimmedName = name?.trim();
	if (!trimmedName || trimmedName === site.metadata.name) {
		return;
	}
	await dispatch(
		updateSiteMetadata({
			slug: site.slug,
			changes: { name: trimmedName },
		})
	);
}

/**
 * Returns the setup URL for creating a new site.
 *
 * Temporary sites keep the current query string for backwards compatibility.
 * Saved sites keep only setup params so routing, UI, and lifecycle params do
 * not leak into persisted metadata. Both paths use the same `SiteSettings`
 * mapping so new settings have one query representation.
 */
function getSetupUrlForNewSite(
	settings: SiteSettings | undefined,
	options: {
		baseUrl: URL;
		onlySetupParams?: boolean;
	}
) {
	const url = options.onlySetupParams
		? getSetupUrlFromUrl(options.baseUrl)
		: new URL(options.baseUrl.href);
	if (settings) {
		if (settings.phpVersion !== undefined) {
			url.searchParams.set('php', settings.phpVersion);
		}
		if (settings.wpVersion !== undefined) {
			url.searchParams.set('wp', settings.wpVersion);
		}
		if (settings.networking !== undefined) {
			url.searchParams.set(
				'networking',
				settings.networking ? 'yes' : 'no'
			);
		}
		if (settings.language !== undefined) {
			url.searchParams.set('language', settings.language);
		}
		if (settings.multisite !== undefined) {
			url.searchParams.set(
				'multisite',
				settings.multisite ? 'yes' : 'no'
			);
		}
	}
	return url;
}

/**
 * Once OPFS sites have loaded, expose the site management API on
 * `window.playgroundSites` and, when the MCP query-arg is present,
 * start the MCP bridge.
 */
startListening({
	actionCreator: setOPFSSitesLoadingState,
	effect: (_action, listenerApi) => {
		listenerApi.unsubscribe();
		window.playgroundSites = createSitesAPI(
			listenerApi.getState,
			listenerApi.dispatch
		);
	},
});

export function useSitesAPI(): PlaygroundSitesAPI {
	const store = useStore<PlaygroundReduxState>();
	const dispatch = useAppDispatch();
	return useMemo(
		() => createSitesAPI(store.getState, dispatch),
		[store, dispatch]
	);
}
