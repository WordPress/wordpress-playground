import { logger } from '@php-wasm/logger';
import type { PHPConstants } from '@wp-playground/blueprints';
import type { PlaygroundClient } from '@wp-playground/remote';
import {
	opfsSiteStorage,
	getDirectoryPathForSlug,
} from '../opfs/opfs-site-storage';
import type { PlaygroundReduxState } from './store';
import type store from './store';
import { selectClientInfoBySiteSlug, updateClientInfo } from './slice-clients';
import {
	selectSiteBySlug,
	selectAllSites,
	updateSiteMetadata,
	removeSite,
} from './slice-sites';
import { PlaygroundRoute, replaceUrl } from '../url/router';

const MAX_AUTO_SAVED_SITES = 20;

/**
 * Auto-saves a temporary site to OPFS in the background after it finishes
 * booting. This is modeled on `persistTemporarySite` but simplified: no
 * rename modal, no pushState URL update (uses replaceState), and the
 * site's `originalUrlParams` are preserved so returning visitors can be
 * matched back to the same persisted site.
 */
export function autoSaveSiteToOpfs(siteSlug: string) {
	return async (
		dispatch: typeof store.dispatch,
		getState: () => PlaygroundReduxState
	) => {
		const site = selectSiteBySlug(getState(), siteSlug);
		if (!site || site.metadata.storage !== 'none') {
			return;
		}
		const clientInfo = selectClientInfoBySiteSlug(getState(), siteSlug);
		if (!clientInfo) {
			return;
		}
		// Dependent tabs don't own the OPFS mount — skip auto-save.
		if (clientInfo.isDependentMode) {
			return;
		}
		const playground = clientInfo.client;

		// Warn the user if they try to close the page during sync.
		const onBeforeUnload = (e: BeforeUnloadEvent) => {
			e.preventDefault();
		};
		window.addEventListener('beforeunload', onBeforeUnload);

		try {
			// Create the OPFS metadata entry with storage: 'none' until
			// sync completes — same pattern as persistTemporarySite.
			try {
				const existingSiteInfo = await opfsSiteStorage?.read(
					site.slug
				);
				if (existingSiteInfo?.metadata.storage === 'none') {
					// Remnants of a previously failed save. Clean up.
					await opfsSiteStorage?.delete(site.slug);
				}
			} catch (error: any) {
				if (error?.name !== 'NotFoundError') {
					throw error;
				}
			}

			await opfsSiteStorage?.create(
				site.slug,
				{
					...site.metadata,
					storage: 'none',
				},
				site.originalUrlParams
			);

			// Set syncing state in redux.
			dispatch(
				updateClientInfo({
					siteSlug,
					changes: { opfsSync: { status: 'syncing' } },
				})
			);

			// Mount OPFS and sync memfs → opfs (the heavy part).
			const mountDescriptor = {
				device: {
					type: 'opfs' as const,
					path: getDirectoryPathForSlug(siteSlug),
				},
				mountpoint: '/wordpress' as const,
			};
			await playground.mountOpfs(
				{
					...mountDescriptor,
					initialSyncDirection: 'memfs-to-opfs',
				},
				(progress) => {
					dispatch(
						updateClientInfo({
							siteSlug,
							changes: {
								opfsSync: { status: 'syncing', progress },
							},
						})
					);
				}
			);

			// Clear syncing state, store mount descriptor.
			dispatch(
				updateClientInfo({
					siteSlug,
					changes: {
						opfsMountDescriptor: mountDescriptor,
						opfsSync: undefined,
					},
				})
			);

			// Update site metadata: storage → 'opfs', autoSaved → true.
			const constants = await getPlaygroundDefinedPHPConstants(playground);
			await dispatch(
				updateSiteMetadata({
					slug: siteSlug,
					changes: {
						storage: 'opfs',
						autoSaved: true,
						whenCreated: Date.now(),
						runtimeConfiguration: {
							...site.metadata.runtimeConfiguration,
							constants,
						},
					},
				})
			);

			// Update URL to include ?site-slug=<slug> via replaceState
			// so refreshing the page will load the persisted site directly.
			const updatedSite = selectSiteBySlug(getState(), siteSlug);
			if (updatedSite) {
				replaceUrl(PlaygroundRoute.site(updatedSite));
			}

			// Clean up old auto-saved sites beyond the retention limit.
			await cleanupOldAutoSavedSites(dispatch, getState);
		} catch (error) {
			logger.error('Auto-save to OPFS failed:', error);
			dispatch(
				updateClientInfo({
					siteSlug,
					changes: { opfsSync: { status: 'error' } },
				})
			);
		} finally {
			window.removeEventListener('beforeunload', onBeforeUnload);
		}
	};
}

async function getPlaygroundDefinedPHPConstants(playground: PlaygroundClient) {
	let constants: PHPConstants = {};
	try {
		constants = JSON.parse(
			await playground.readFileAsText('/internal/shared/consts.json')
		);
	} catch {
		// Do nothing
	}
	return constants;
}

/**
 * Removes the oldest auto-saved sites once the count exceeds
 * MAX_AUTO_SAVED_SITES.
 */
async function cleanupOldAutoSavedSites(
	dispatch: typeof store.dispatch,
	getState: () => PlaygroundReduxState
) {
	const allSites = selectAllSites(getState());
	const autoSaved = allSites
		.filter((s) => s.metadata.autoSaved && s.metadata.storage === 'opfs')
		.sort(
			(a, b) =>
				(b.metadata.whenCreated || 0) - (a.metadata.whenCreated || 0)
		);

	const toRemove = autoSaved.slice(MAX_AUTO_SAVED_SITES);
	for (const site of toRemove) {
		try {
			await dispatch(removeSite(site.slug));
		} catch (error) {
			logger.error(
				`Failed to remove old auto-saved site ${site.slug}:`,
				error
			);
		}
	}
}
