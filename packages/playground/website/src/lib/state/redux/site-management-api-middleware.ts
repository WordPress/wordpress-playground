import { useMemo } from 'react';
import { useStore } from 'react-redux';
import { createListenerMiddleware } from '@reduxjs/toolkit';
import type { PlaygroundReduxState, PlaygroundDispatch } from './store';
import { selectActiveSite, setActiveSite, useAppDispatch } from './store';
import { setActiveSiteError } from './slice-ui';
import { addClientInfo } from './slice-clients';
import {
	selectAllSites,
	selectSiteBySlug,
	setOPFSSitesLoadingState,
	updateSiteMetadata,
	removeSite,
	setTemporarySiteSpec,
	deriveSiteNameFromSlug,
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

/**
 * API for listing, renaming, saving, and opening Playground
 * sites. Used by the MCP bridge, the `window.playgroundSites`
 * DevTools global, and UI components.
 */
export interface PlaygroundSitesAPI {
	/**
	 * Lists all known sites.
	 *
	 * @returns List of site info objects.
	 */
	list(): Array<{
		slug: string;
		name: string;
		storage: string;
		isActive: boolean;
	}>;

	/**
	 * Returns the PlaygroundClient for the active site.
	 *
	 * @returns The client, or `undefined` if not yet booted.
	 * @throws When no site is selected.
	 */
	getClient(): PlaygroundClient | undefined;

	/**
	 * Renames the active site.
	 *
	 * @param newName The new display name.
	 * @throws When no site is selected or the site is
	 *   temporary.
	 */
	rename(newName: string): Promise<void>;

	/**
	 * Persists the active temporary site to OPFS.
	 *
	 * @param name Optional display name for the saved site.
	 * @returns The site's slug and storage type.
	 * @throws When no site is selected or saving fails.
	 */
	saveInBrowser(name?: string): Promise<{ slug: string; storage: string }>;

	/**
	 * Persists the active temporary site to a local directory.
	 *
	 * @param name Optional display name for the saved site.
	 * @param localFsHandle Directory handle. When omitted the
	 *   browser prompts the user to pick one.
	 * @returns The site's slug and storage type.
	 * @throws When no site is selected or saving fails.
	 */
	saveToLocalFileSystem(
		name?: string,
		localFsHandle?: FileSystemDirectoryHandle
	): Promise<{ slug: string; storage: string }>;

	/**
	 * Changes the PHP version for the active site and reboots it.
	 *
	 * @param version The PHP version to use (e.g. `"8.4"`).
	 * @throws When no site is selected or the site is temporary.
	 */
	setPhpVersion(version: AllPHPVersion): Promise<void>;

	/**
	 * Enables or disables network access for the active site
	 * and reboots it.
	 *
	 * @param enabled Whether networking should be on.
	 * @throws When no site is selected or the site is temporary.
	 */
	setNetworking(enabled: boolean): Promise<void>;

	/**
	 * Deletes a saved site by slug.
	 *
	 * @param siteSlug The slug of the site to delete.
	 * @throws When the site is not found or the site is temporary.
	 */
	delete(siteSlug: string): Promise<void>;

	/**
	 * Switches to a different site and boots it.
	 *
	 * @param siteSlug The slug of the site to activate.
	 * @throws When the site is not found or fails to boot.
	 */
	setActiveSite(siteSlug: string): Promise<void>;

	/**
	 * Creates a new temporary site and boots it.
	 *
	 * @param siteSlug Optional slug hint. A random name is
	 *   generated when omitted.
	 * @param settings Optional site settings.
	 * @returns The new site's slug.
	 */
	createNewTemporarySite(
		siteSlug?: string,
		settings?: SiteSettings
	): Promise<string>;
}

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

export function createSitesAPI(
	getState: () => PlaygroundReduxState,
	dispatch: PlaygroundDispatch
): PlaygroundSitesAPI {
	const api: PlaygroundSitesAPI = {
		list() {
			const state = getState();
			const allSites = selectAllSites(state);
			const active = selectActiveSite(state);
			/**
			 * We rename storage "none" to "temporary" in the API because the name temporary
			 * is more descriptive of the actual behavior of these sites.
			 */
			return allSites.map((s) => ({
				slug: s.slug,
				name: s.metadata.name,
				storage:
					s.metadata.storage === 'none'
						? 'temporary'
						: s.metadata.storage,
				isActive: s.slug === active?.slug,
			}));
		},

		getClient() {
			const site = selectActiveSite(getState());
			if (!site) {
				throw new Error('No active site selected');
			}
			return selectClientBySiteSlug(getState(), site.slug);
		},

		async rename(newName: string) {
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
					changes: { name: newName },
				})
			);
		},

		async saveInBrowser(name?: string) {
			const site = selectActiveSite(getState());
			if (!site) {
				throw new Error('No active site selected');
			}
			if (site.metadata.storage !== 'none') {
				return { slug: site.slug, storage: site.metadata.storage };
			}
			await dispatch(
				persistTemporarySite(site.slug, 'opfs', {
					siteName: name,
					skipRenameModal: true,
				})
			);
			const updatedSite = selectSiteBySlug(getState(), site.slug);
			const storage = updatedSite?.metadata.storage ?? 'none';
			return { slug: site.slug, storage };
		},

		async saveToLocalFileSystem(
			name?: string,
			localFsHandle?: FileSystemDirectoryHandle
		) {
			const site = selectActiveSite(getState());
			if (!site) {
				throw new Error('No active site selected');
			}
			if (site.metadata.storage !== 'none') {
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
			const storage = updatedSite?.metadata.storage ?? 'none';
			return { slug: site.slug, storage };
		},

		async setPhpVersion(version: AllPHPVersion) {
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

		async setNetworking(enabled: boolean) {
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

		async delete(siteSlug: string) {
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

		async setActiveSite(siteSlug: string) {
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
							const details = action.payload.details;
							const message =
								typeof details === 'string'
									? details
									: (details?.message ??
										action.payload.error);
							reject(new Error(message));
						} else {
							resolve();
						}
					},
				});
			});
			dispatch(setActiveSite(siteSlug));
			await bootPromise;
		},

		async createNewTemporarySite(
			requestedSiteSlug?: string,
			settings?: SiteSettings
		) {
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
