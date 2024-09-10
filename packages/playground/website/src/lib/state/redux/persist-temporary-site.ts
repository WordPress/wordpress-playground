import { logger } from '@php-wasm/logger';
import { MountDescriptor } from '@wp-playground/remote';
import { saveDirectoryHandle } from '../opfs/opfs-directory-handle-storage';
import {
	opfsSiteStorage,
	getDirectoryNameForSlug,
} from '../opfs/opfs-site-storage';
import { updateUrl } from '../url/router-hooks';
import store, { PlaygroundReduxState } from './store';
import { selectClientBySiteSlug, updateClientInfo } from './slice-clients';
import { selectSiteBySlug, updateSite } from './slice-sites';

export function persistTemporarySite(
	siteSlug: string,
	storageType: 'opfs' | 'local-fs'
) {
	// @TODO: Handle errors
	return async (
		dispatch: typeof store.dispatch,
		getState: () => PlaygroundReduxState
	) => {
		const state = getState();
		const playground = selectClientBySiteSlug(state, siteSlug);
		if (!playground) {
			throw new Error(
				`Site ${siteSlug} must have an active client to be saved, but none was found.`
			);
		}

		const siteInfo = selectSiteBySlug(state, siteSlug)!;
		if (!siteInfo) {
			throw new Error(`Cannot find site ${siteSlug} to save.`);
		}
		await opfsSiteStorage?.create(siteInfo.slug, {
			...siteInfo.metadata,
			storage: storageType,
		});

		let mountDescriptor: Omit<MountDescriptor, 'initialSyncDirection'>;
		if (storageType === 'opfs') {
			mountDescriptor = {
				device: {
					type: 'opfs',
					path: '/' + getDirectoryNameForSlug(siteSlug),
				},
				mountpoint: '/wordpress',
			} as const;
		} else if (storageType === 'local-fs') {
			let dirHandle: FileSystemDirectoryHandle;
			try {
				// Request permission to access the directory.
				// https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker
				dirHandle = await (window as any).showDirectoryPicker({
					// By specifying an ID, the browser can remember different directories
					// for different IDs.If the same ID is used for another picker, the
					// picker opens in the same directory.
					id: 'playground-directory',
					mode: 'readwrite',
				});
			} catch (e) {
				// No directory selected but log the error just in case.
				logger.error(e);
				return;
			}
			await saveDirectoryHandle(siteSlug, dirHandle);

			mountDescriptor = {
				device: {
					type: 'local-fs',
					handle: dirHandle,
				},
				mountpoint: '/wordpress',
			} as const;
		} else {
			throw new Error(`Unsupported device type: ${storageType}`);
		}

		dispatch(
			updateClientInfo({
				siteSlug,
				changes: {
					opfsMountDescriptor: mountDescriptor,
					opfsIsSyncing: true,
				},
			})
		);
		try {
			await playground!.mountOpfs(
				{
					...mountDescriptor,
					initialSyncDirection: 'memfs-to-opfs',
				},
				(progress) => {
					dispatch(
						updateClientInfo({
							siteSlug,
							changes: {
								opfsSyncProgress: progress,
							},
						})
					);
				}
			);
		} finally {
			// @TODO: Tell the user the operation is complete
			dispatch(
				updateClientInfo({
					siteSlug,
					changes: {
						opfsIsSyncing: false,
						opfsSyncProgress: undefined,
					},
				})
			);
		}

		dispatch(
			updateSite({
				id: siteSlug,
				changes: {
					originalUrlParams: undefined,
					metadata: {
						...siteInfo.metadata,
						storage: storageType,
					},
				},
			})
		);

		window.history.pushState(
			{},
			'',
			updateUrl(window.location.href, {
				searchParams: {
					'site-slug': siteSlug,
				},
			})
		);
	};
}
