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
	preserveSite,
	setTemporarySiteSpec,
	deriveSiteNameFromSlug,
	getSitePublicPersistence,
	isAutosavedSite,
	type SitePersistence,
	type SiteStorageType,
} from './slice-sites';
import { randomSiteName } from './random-site-name';
import { persistTemporarySite } from './persist-temporary-site';
import { selectClientBySiteSlug } from './slice-clients';
import type { PlaygroundClient } from '@wp-playground/remote';
import type { AllPHPVersion } from '@php-wasm/universal';

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
		 * Renames the active site.
		 *
		 * @param newName The new display name.
		 * @throws When no site is selected or the site is
		 *   temporary.
		 */
		async rename(newName: string): Promise<void> {
			const site = selectActiveSite(getState());
			if (!site) {
				throw new Error('No active site selected');
			}
			if (site.metadata.storage === 'none') {
				throw new Error(
					'Cannot rename a temporary site. Save it first.'
				);
			}
			await dispatch(
				updateSiteMetadata({
					slug: site.slug,
					changes: { name: newName, persistence: 'explicit' },
				})
			);
		},

		/**
		 * Saves the active Playground in browser storage when it is temporary.
		 *
		 * Temporary sites are persisted to OPFS. Existing autosaves are marked as
		 * explicitly saved and returned without changing storage backends.
		 *
		 * @param name Optional display name for a temporary site being saved.
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
					await dispatch(preserveSite(site.slug));
				}
				return { slug: site.slug, storage: site.metadata.storage };
			}
			await dispatch(
				persistTemporarySite(site.slug, 'opfs', {
					siteName: name,
					skipRenameModal: true,
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
		 * no longer treat it as disposable. It does not copy files, change the
		 * storage backend, rename the Playground, or reboot it. Already-explicit
		 * stored Playgrounds are left explicit.
		 *
		 * @param siteSlug Optional slug. Uses the active site when omitted.
		 * @throws When no site is selected, the slug is unknown, or the site is
		 *   temporary.
		 */
		async keep(siteSlug?: string): Promise<void> {
			const site = siteSlug
				? selectSiteBySlug(getState(), siteSlug)
				: selectActiveSite(getState());
			if (!site) {
				throw new Error('No site selected');
			}
			// "Keeping" an autosave only changes lifecycle metadata. The
			// filesystem stays in the same storage backend.
			await dispatch(preserveSite(site.slug));
		},

		/**
		 * Saves the active Playground to a local directory when it is temporary.
		 *
		 * Existing saved sites are returned without changing storage backends.
		 * Existing autosaves are marked as explicitly saved first.
		 *
		 * @param name Optional display name for a temporary site being saved.
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
				if (isAutosavedSite(site)) {
					await dispatch(preserveSite(site.slug));
				}
				return { slug: site.slug, storage: site.metadata.storage };
			}
			await dispatch(
				persistTemporarySite(site.slug, 'local-fs', {
					siteName: name,
					localFsHandle,
					skipRenameModal: true,
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
		 * @throws When the site is not found or fails to boot.
		 */
		async setActiveSite(siteSlug: string): Promise<void> {
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
			dispatch(setActiveSite(siteSlug));
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
			const url = new URL(window.location.href);
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
			const newSiteInfo = await dispatch(
				setTemporarySiteSpec(siteName, url, requestedSiteSlug)
			);
			await api.setActiveSite(newSiteInfo.slug);
			return newSiteInfo.slug;
		},
	};
	return api;
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
