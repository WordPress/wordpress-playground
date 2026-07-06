import { logger } from '@php-wasm/logger';
import type { MountDescriptor, PlaygroundClient } from '@wp-playground/remote';
import type { PHPConstants } from '@wp-playground/blueprints';
import { saveDirectoryHandle } from '../opfs/opfs-directory-handle-storage';
import {
	opfsSiteStorage,
	getDirectoryPathForSlug,
} from '../opfs/opfs-site-storage';
import { persistBlueprintBundle } from '../opfs/opfs-blueprint-bundle-storage';
import type { TraversableFilesystemBackend } from '@wp-playground/storage';
import type { PlaygroundReduxState } from './store';
import type store from './store';
import { selectClientBySiteSlug, updateClientInfo } from './slice-clients';
import {
	selectSiteBySlug,
	type SitePersistence,
	updateSite,
	updateSiteMetadata,
} from './slice-sites';
import { PlaygroundRoute, redirectTo } from '../url/router';
import type { SiteStorageType } from './slice-sites';
import { setActiveModal } from './slice-ui';

/**
 * Copies the running Playground into a durable storage backend.
 *
 * Temporary sites need a new storage record before the copy starts. Autosaved
 * sites already have one, so saving them to a local directory only remounts the
 * running filesystem and updates the existing metadata after the copy succeeds.
 */
export function persistTemporarySite(
	siteSlug: string,
	storageType: Extract<SiteStorageType, 'opfs' | 'local-fs'>,
	options: {
		localFsHandle?: FileSystemDirectoryHandle;
		siteName?: string;
		skipRenameModal?: boolean;
		persistence?: SitePersistence;
		updateUrl?: boolean;
	} = {}
) {
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

		let siteInfo = selectSiteBySlug(state, siteSlug)!;
		if (!siteInfo) {
			throw new Error(`Cannot find site ${siteSlug} to save.`);
		}
		const trimmedName = options.siteName?.trim();
		if (trimmedName && trimmedName !== siteInfo.metadata.name) {
			await dispatch(
				updateSiteMetadata({
					slug: siteSlug,
					changes: { name: trimmedName },
				})
			);
			siteInfo = selectSiteBySlug(getState(), siteSlug)!;
		}

		const isTemporarySite = siteInfo.metadata.storage === 'none';
		if (isTemporarySite) {
			try {
				const existingSiteInfo = await opfsSiteStorage?.read(
					siteInfo.slug
				);
				if (existingSiteInfo?.metadata.storage === 'none') {
					// It is likely we are dealing with the remnants of a failed save
					// of a temporary site to OPFS. Let's clean up and try again.
					await opfsSiteStorage?.delete(siteInfo.slug);
				}
			} catch (error: any) {
				if (error?.name === 'NotFoundError') {
					// No failed temporary-site placeholder exists, so this save can
					// continue with a fresh OPFS record.
				} else {
					throw error;
				}
			}
			await opfsSiteStorage?.create(siteInfo.slug, {
				...siteInfo.metadata,
				// The placeholder stays marked as temporary until the copy
				// succeeds, so a later save can recognize and clean up a failed
				// attempt.
				storage: 'none',
			});
		}

		// Persist a Blueprint bundle only after the user has run the edited
		// Blueprint. Editor-only changes stay in memory so a draft from one
		// temporary Playground cannot be saved into another site by accident.
		let bundleToPersist: TraversableFilesystemBackend | null = null;

		const originalBlueprint = siteInfo.metadata.originalBlueprint;
		if (
			originalBlueprint &&
			typeof originalBlueprint === 'object' &&
			'read' in originalBlueprint &&
			'listFiles' in originalBlueprint &&
			'isDir' in originalBlueprint
		) {
			bundleToPersist =
				originalBlueprint as unknown as TraversableFilesystemBackend;
		}

		let bundleWasPersisted = false;
		if (bundleToPersist) {
			try {
				await persistBlueprintBundle(siteSlug, bundleToPersist);
				bundleWasPersisted = true;
			} catch (error) {
				logger.error('Failed to persist blueprint bundle', error);
				// The site filesystem is still useful without the editor bundle.
			}
		}

		let mountDescriptor: Omit<MountDescriptor, 'initialSyncDirection'>;
		if (storageType === 'opfs') {
			mountDescriptor = {
				device: {
					type: 'opfs',
					path: getDirectoryPathForSlug(siteSlug),
				},
				mountpoint: '/wordpress',
			} as const;
		} else if (storageType === 'local-fs') {
			let dirHandle: FileSystemDirectoryHandle;
			if (options.localFsHandle) {
				dirHandle = options.localFsHandle;
			} else {
				// Request permission to access the directory.
				// https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker
				dirHandle = (await (window as any).showDirectoryPicker({
					// By specifying an ID, the browser can remember different directories
					// for different IDs.If the same ID is used for another picker, the
					// picker opens in the same directory.
					id: 'playground-directory',
					mode: 'readwrite',
				})) as FileSystemDirectoryHandle;
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
		const isAutosave = options.persistence === 'autosave';
		const syncOperation = isAutosave ? 'autosave' : 'save';

		dispatch(
			updateClientInfo({
				siteSlug,
				changes: {
					opfsMountDescriptor: mountDescriptor,
					opfsSync: {
						status: 'syncing',
						operation: syncOperation,
					},
				},
			})
		);
		try {
			/**
			 * Autosaved browser sites already mount OPFS at `/wordpress`.
			 * We need to unmount it before we can mount a local directory at `/wordpress`.
			 *
			 * That works, because all the files we need are available in MEMFS despite the prior
			 * OPFS mount. The OPFS mount doesn't replace the MEMFS `/wordpress` directory.
			 * Instead, it attaches a filesystem journal to periodically rewrite all the operations to
			 * the right OPFS location. Therefore, the files are in MEMFS and are ready to be copied
			 * to the local filesystem.
			 */
			if (await playground.hasOpfsMount(mountDescriptor.mountpoint)) {
				await playground.unmountOpfs(mountDescriptor.mountpoint);
			}
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
								opfsSync: {
									status: 'syncing',
									progress,
									operation: syncOperation,
								},
							},
						})
					);
				}
			);

			// @TODO: Create a notification to tell the user the operation is complete
			dispatch(
				updateClientInfo({
					siteSlug,
					changes: {
						opfsSync: undefined,
					},
				})
			);
		} catch (error) {
			dispatch(
				updateClientInfo({
					siteSlug,
					changes: {
						opfsSync: {
							status: 'error',
							operation: syncOperation,
						},
					},
				})
			);
			throw error;
		}

		// Autosaves stay tied to their source setup URL so restore matching and
		// boot-time query options can still inspect it. Explicit saves open by
		// slug, so drop the temporary route params after persistence.
		if (!isAutosave) {
			await dispatch(
				updateSite({
					slug: siteSlug,
					changes: {
						originalUrlParams: undefined,
					},
				})
			);
		}

		const persistedAt = Date.now();
		const playgroundDefinedConstants =
			await getPlaygroundDefinedPHPConstants(playground);
		await dispatch(
			updateSiteMetadata({
				slug: siteSlug,
				changes: {
					storage: storageType,
					persistence: options.persistence ?? 'explicit',
					// The viewport key includes whenCreated. Changing it would
					// remount the iframe, so autosave keeps the current value
					// while explicit saves reset the creation time.
					...(isAutosave ? {} : { whenCreated: persistedAt }),
					whenLastUsed: persistedAt,
					// Keep these outside runtimeConfiguration so autosave does not
					// change the running iframe's boot fingerprint.
					playgroundDefinedConstants,
					// If we persisted a blueprint bundle, point to it so we can
					// load the full bundle (not just the declaration) on next load.
					...(bundleWasPersisted
						? {
								originalBlueprintSource: {
									type: 'opfs-site' as const,
								},
							}
						: {}),
					...(trimmedName ? { name: trimmedName } : {}),
				},
			})
		);
		/**
		 * @TODO: Fix OPFS site storage write timeout that happens alongside 2000
		 *        "Cannot read properties of undefined (reading 'apply')" errors here:
		 * I suspect the postMessage call we do to the safari worker causes it to
		 * respond with another message and these unexpected exchange throws off
		 * Comlink. We should make Comlink ignore those.
		 */
		// @TODO: ^ Is this fixed now?
		const updatedSite = selectSiteBySlug(getState(), siteSlug);
		const persistentSiteUrl = PlaygroundRoute.site(updatedSite!);
		if (options.updateUrl) {
			redirectTo(persistentSiteUrl);
		}
		if (!options.skipRenameModal) {
			dispatch(setActiveModal('rename-site'));
		}
	};
}

/**
 * Returns constants registered through Playground's live PHP API.
 *
 * Calls to `playground.defineConstant()` are persisted in consts.json after the
 * iframe has already booted. Examples include `PLAYGROUND_AUTO_LOGIN_AS_USER`
 * from the login step, `WPLANG` from the language step, and caller-defined
 * constants such as `WP_DEBUG`. Saved sites need to replay them on reload, but
 * writing them into `runtimeConfiguration` during autosave would change the
 * running iframe's boot fingerprint and force an unnecessary reboot.
 */
async function getPlaygroundDefinedPHPConstants(playground: PlaygroundClient) {
	let constants: PHPConstants = {};
	try {
		constants = JSON.parse(
			await playground.readFileAsText('/internal/shared/consts.json')
		);
	} catch {
		// The file is absent until code defines constants through Playground.
	}
	return constants;
}
