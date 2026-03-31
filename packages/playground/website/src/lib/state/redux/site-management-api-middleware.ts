/**
 * Centralized Playground site management middleware.
 *
 * Provides a unified API for listing, renaming, saving, and opening
 * Playground sites. Used by the MCP bridge, the browser DevTools global
 * (`window.playgroundSites`), and any other part of the Playground
 * Website that needs programmatic site access.
 */

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
import type { SupportedPHPVersion } from '@php-wasm/universal';

export interface SiteSettings {
	phpVersion?: SupportedPHPVersion;
	wpVersion?: string;
	networking?: boolean;
	language?: string;
	multisite?: boolean;
}

export interface PlaygroundSitesAPI {
	list(): Array<{
		slug: string;
		name: string;
		storage: string;
		isActive: boolean;
	}>;
	getClient(): PlaygroundClient | undefined;
	rename(newName: string): Promise<void>;
	saveInBrowser(name?: string): Promise<{ slug: string; storage: string }>;
	saveToLocalFileSystem(
		name?: string,
		localFsHandle?: FileSystemDirectoryHandle
	): Promise<{ slug: string; storage: string }>;
	setPhpVersion(version: SupportedPHPVersion): Promise<void>;
	setNetworking(enabled: boolean): Promise<void>;
	delete(siteSlug: string): Promise<void>;
	setActiveSite(siteSlug: string): Promise<void>;
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
	function getActiveSiteOrThrow() {
		const site = selectActiveSite(getState());
		if (!site) {
			throw new Error('No active site');
		}
		return site;
	}

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
			const site = getActiveSiteOrThrow();
			return selectClientBySiteSlug(getState(), site.slug);
		},

		async rename(newName: string) {
			const site = getActiveSiteOrThrow();
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
			const site = getActiveSiteOrThrow();
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
			if (storage === 'none') {
				throw new Error(
					'Failed to save the site — the storage is still temporary after persist.'
				);
			}
			return { slug: site.slug, storage };
		},

		async saveToLocalFileSystem(
			name?: string,
			localFsHandle?: FileSystemDirectoryHandle
		) {
			const site = getActiveSiteOrThrow();
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
			if (storage === 'none') {
				throw new Error(
					'Failed to save the site — the storage is still temporary after persist.'
				);
			}
			return { slug: site.slug, storage };
		},

		async setPhpVersion(version: SupportedPHPVersion) {
			const site = getActiveSiteOrThrow();
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
			const site = getActiveSiteOrThrow();
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
					'Cannot delete a temporary site. It will be removed automatically when you close the tab.'
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
				setTemporarySiteSpec(siteName, url)
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
