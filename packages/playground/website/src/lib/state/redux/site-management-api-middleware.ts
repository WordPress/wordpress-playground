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
import { setActiveSiteError } from './slice-ui';
import { addClientInfo } from './slice-clients';
import {
	selectAllSites,
	selectSiteBySlug,
	setOPFSSitesLoadingState,
	updateSiteMetadata,
	removeSite,
	pruneAutosavedSites,
	preserveSite,
	resetAutosavedSiteSpec,
	setTemporarySiteSpec,
	setStoredSiteSpec,
	deriveSiteNameFromSlug,
	getSitePublicPersistence,
	isAutosavedSite,
	type SiteInfo,
	type SitePersistence,
	type SiteStorageType,
} from './slice-sites';
import { randomSiteName } from './random-site-name';
import { persistTemporarySite } from './persist-temporary-site';
import { selectClientBySiteSlug } from './slice-clients';
import type { PlaygroundClient } from '@wp-playground/remote';
import type { AllPHPVersion } from '@php-wasm/universal';
import { opfsSiteStorage } from '../opfs/opfs-site-storage';
import { getSetupUrlFromUrl } from '../playground-identity';
import { redirectTo } from '../url/router';

export interface SiteSettings {
	phpVersion?: AllPHPVersion;
	wpVersion?: string;
	networking?: boolean;
	language?: string;
	multisite?: boolean;
}

type PublicSiteStorageType = Exclude<SiteStorageType, 'none'> | 'temporary';
type SaveSiteResult = { slug: string; storage: SiteStorageType };

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
		 * asks to route to the new stored site.
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
			if (site.metadata.storage !== 'none') {
				return { slug: site.slug, storage: site.metadata.storage };
			}
			await dispatch(
				persistTemporarySite(site.slug, 'opfs', {
					skipRenameModal: true,
					persistence: 'autosave',
					updateUrl: options.updateUrl ?? false,
				})
			);
			await dispatch(
				pruneAutosavedSites({
					excludeSlugs: [
						site.slug,
						...(options.excludeFromPruning ?? []),
					],
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
		 * Recreates the active autosaved Playground with new setup settings.
		 *
		 * Autosaved Playgrounds behave like recoverable unsaved work: changing
		 * setup settings replaces the current WordPress files under the same
		 * autosaved slug instead of creating another autosave.
		 *
		 * @param settings Optional site settings.
		 * @throws When no site is selected, the active site is not autosaved, or
		 *   browser storage cannot be reset.
		 */
		async recreateAutosavedSite(settings?: SiteSettings): Promise<void> {
			const site = selectActiveSite(getState());
			if (!site) {
				throw new Error('No active site selected');
			}
			if (!isAutosavedSite(site)) {
				throw new Error(
					'Only autosaved Playgrounds can be recreated in place.'
				);
			}
			const setupUrl = getSetupUrlForNewSite(settings, {
				onlySetupParams: true,
			});
			await dispatch(resetAutosavedSiteSpec(site.slug, setupUrl));
			redirectTo(setupUrl.toString());
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
				updateSiteMetadata({
					slug: site.slug,
					changes: {
						runtimeConfiguration: {
							...site.metadata.runtimeConfiguration,
							phpVersion: version,
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
				updateSiteMetadata({
					slug: site.slug,
					changes: {
						runtimeConfiguration: {
							...site.metadata.runtimeConfiguration,
							networking: enabled,
						},
					},
				})
			);
		},

		/**
		 * Deletes a saved site by slug.
		 *
		 * @param siteSlug The slug of the site to delete.
		 * @throws When the site is not found or the site is temporary.
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
		 * @param siteSlug Optional slug hint. A random name is
		 *   generated when omitted.
		 * @param settings Optional site settings.
		 * @returns The new site's slug.
		 */
		async createNewTemporarySite(
			requestedSiteSlug?: string,
			settings?: SiteSettings
		): Promise<string> {
			const siteName = requestedSiteSlug
				? deriveSiteNameFromSlug(requestedSiteSlug)
				: randomSiteName();
			const url = getSetupUrlForNewSite(settings);
			const newSiteInfo = await dispatch(
				setTemporarySiteSpec(siteName, url, requestedSiteSlug)
			);
			await api.setActiveSite(newSiteInfo.slug);
			return newSiteInfo.slug;
		},

		/**
		 * Creates a new browser-stored site and boots it.
		 *
		 * The site starts as an explicit save unless the caller marks it as an
		 * autosave. First boot creates the WordPress files from the setup URL,
		 * then stores that initialized filesystem in OPFS for later boots.
		 *
		 * @param requestedSiteSlug Optional slug hint. A random name is
		 *   generated when omitted.
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
			if (!opfsSiteStorage) {
				throw new Error(
					'Cannot create a saved Playground because browser storage is not available.'
				);
			}
			const siteName = requestedSiteSlug
				? deriveSiteNameFromSlug(requestedSiteSlug)
				: randomSiteName();
			const url = getSetupUrlForNewSite(settings, {
				onlySetupParams: true,
			});
			const newSiteInfo = await dispatch(
				setStoredSiteSpec(siteName, url, requestedSiteSlug, {
					persistence: options.persistence ?? 'explicit',
				})
			);
			await api.setActiveSite(newSiteInfo.slug, {
				updateUrl: options.updateUrl,
			});
			await dispatch(
				pruneAutosavedSites({
					excludeSlugs: [
						newSiteInfo.slug,
						...(options.excludeFromPruning ?? []),
					],
				})
			);
			return newSiteInfo.slug;
		},
	};
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
	settings?: SiteSettings,
	options: {
		onlySetupParams?: boolean;
	} = {}
) {
	const currentUrl = new URL(window.location.href);
	const url = options.onlySetupParams
		? getSetupUrlFromUrl(currentUrl)
		: currentUrl;
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
