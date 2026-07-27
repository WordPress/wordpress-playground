import { logger } from '@php-wasm/logger';
import type { MountDescriptor, PlaygroundClient } from '@wp-playground/remote';
import type { PHPConstants } from '@wp-playground/blueprints';
import { saveDirectoryHandle } from '../opfs/opfs-directory-handle-storage';
import {
	opfsSiteStorage,
	getDirectoryPathForSlug,
} from '../opfs/opfs-site-storage';
import {
	isTraversableFilesystemBackend,
	persistBlueprintBundle,
} from '../opfs/opfs-blueprint-bundle-storage';
import type { TraversableFilesystemBackend } from '@wp-playground/storage';
import type { PlaygroundReduxState } from './store';
import type store from './store';
import {
	selectClientBySiteSlug,
	selectClientInfoBySiteSlug,
	updateClientInfo,
} from './slice-clients';
import {
	selectSiteBySlug,
	type SiteInfo,
	type SitePersistence,
	updateSite,
} from './slice-sites';
import { PlaygroundRoute, redirectTo } from '../url/router';
import type { SiteStorageType } from './slice-sites';
import { setActiveModal } from './slice-ui';
import { getSetupUrlFromSite } from '../playground-identity';
import { captureAndPersistSiteThumbnail } from './capture-site-thumbnail';

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
		const clientInfo = selectClientInfoBySiteSlug(state, siteSlug);
		const playground =
			clientInfo?.client ?? selectClientBySiteSlug(state, siteSlug);
		if (!playground) {
			throw new Error(
				`Site ${siteSlug} must have an active client to be saved, but none was found.`
			);
		}
		const previousMountDescriptor = clientInfo?.opfsMountDescriptor;

		const siteInfo = selectSiteBySlug(state, siteSlug);
		if (!siteInfo) {
			throw new Error(`Cannot find site ${siteSlug} to save.`);
		}
		if (storageType === 'opfs' && !opfsSiteStorage) {
			throw new Error(
				'Cannot save this Playground because browser storage is not available.'
			);
		}
		const trimmedName = options.siteName?.trim();

		const isTemporarySite = siteInfo.metadata.storage === 'none';
		let shouldCreatePendingOpfsSaveRecord = true;
		if (isTemporarySite && opfsSiteStorage) {
			try {
				const existingSiteInfo = await opfsSiteStorage?.read(
					siteInfo.slug
				);
				if (existingSiteInfo?.metadata.storage === 'none') {
					const pendingSaveDirectory = getDirectoryPathForSlug(
						siteInfo.slug
					);
					const currentRuntimeUsesPendingOpfsDirectory =
						previousMountDescriptor?.device.type === 'opfs' &&
						previousMountDescriptor.device.path ===
							pendingSaveDirectory &&
						(await playground
							.hasOpfsMount(previousMountDescriptor.mountpoint)
							.catch(() => false));

					shouldCreatePendingOpfsSaveRecord =
						!currentRuntimeUsesPendingOpfsDirectory;
					if (shouldCreatePendingOpfsSaveRecord) {
						// A failed first save can leave `wp-runtime.json` with
						// `storage: "none"`. That record only reserves the OPFS
						// directory until the file copy finishes; it is not a
						// saved Playground yet. If the current runtime is not
						// mounted to that directory, remove the stale directory
						// before retrying so old files cannot mix into the new
						// save.
						await opfsSiteStorage?.delete(siteInfo.slug);
					}
				}
			} catch (error: any) {
				if (error?.name === 'NotFoundError') {
					// No pending OPFS save record exists, so this save can
					// continue with a fresh OPFS record.
				} else {
					throw error;
				}
			}
			if (shouldCreatePendingOpfsSaveRecord) {
				await opfsSiteStorage.create(
					siteInfo.slug,
					{
						...siteInfo.metadata,
						// The record stays marked as temporary until the copy
						// succeeds, so a later retry can tell whether the first
						// save became a real stored Playground.
						storage: 'none',
					},
					siteInfo.originalUrlParams
				);
			}
		}

		// Persist a Blueprint bundle only after the user has run the edited
		// Blueprint. Editor-only changes stay in memory so a draft from one
		// temporary Playground cannot be saved into another site by accident.
		let bundleToPersist: TraversableFilesystemBackend | null = null;

		const originalBlueprint = siteInfo.metadata.originalBlueprint;
		if (isTraversableFilesystemBackend(originalBlueprint)) {
			bundleToPersist = originalBlueprint;
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
					opfsSync: {
						status: 'syncing',
						operation: syncOperation,
					},
				},
			})
		);
		let restorePreviousMount = false;
		let currentRuntimeMountDescriptor:
			| typeof mountDescriptor
			| typeof previousMountDescriptor
			| undefined = previousMountDescriptor;
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
				currentRuntimeMountDescriptor = undefined;
				restorePreviousMount = Boolean(previousMountDescriptor);
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
			restorePreviousMount = false;
			currentRuntimeMountDescriptor = mountDescriptor;

			const persistedAt = Date.now();
			const playgroundDefinedConstants =
				await getPlaygroundDefinedPHPConstants(playground);
			const siteChanges: Parameters<typeof updateSite>[0]['changes'] = {
				// Autosaves stay tied to their source setup URL so restore
				// matching and boot-time query options can still inspect it.
				// Explicit saves open by slug, but they still keep their setup
				// URL for settings and sharing.
				...(isAutosave
					? {}
					: {
							originalUrlParams: getSavedSetupUrlParams(siteInfo),
						}),
				metadata: {
					storage: storageType,
					persistence: options.persistence ?? 'explicit',
					// The viewport key includes whenCreated. Changing it
					// would remount the iframe, so autosave keeps the current
					// value while explicit saves reset the creation time.
					...(isAutosave ? {} : { whenCreated: persistedAt }),
					whenLastUsed: persistedAt,
					// Keep these outside runtimeConfiguration so autosave does
					// not change the running iframe's boot fingerprint.
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
			};
			await dispatch(
				updateSite({
					slug: siteSlug,
					changes: siteChanges,
				})
			);

			// @TODO: Create a notification to tell the user the operation is complete
			dispatch(
				updateClientInfo({
					siteSlug,
					changes: {
						opfsMountDescriptor: mountDescriptor,
						opfsSync: undefined,
					},
				})
			);
			void captureAndPersistSiteThumbnail({
				playground,
				siteSlug,
				dispatch,
				getState,
			});
		} catch (error) {
			if (
				storageType === 'local-fs' &&
				currentRuntimeMountDescriptor === mountDescriptor
			) {
				try {
					await playground.unmountOpfs(mountDescriptor.mountpoint);
					currentRuntimeMountDescriptor = undefined;
					restorePreviousMount = Boolean(previousMountDescriptor);
				} catch (unmountNewMountError) {
					logger.error(
						'Error unmounting the local directory after save failure.',
						unmountNewMountError
					);
				}
			}
			if (restorePreviousMount && previousMountDescriptor) {
				try {
					await playground.mountOpfs({
						...previousMountDescriptor,
						initialSyncDirection: 'memfs-to-opfs',
					});
					currentRuntimeMountDescriptor = previousMountDescriptor;
				} catch (restoreError) {
					logger.error(
						'Error restoring the previous storage mount after save failure.',
						restoreError
					);
				}
			}
			dispatch(
				updateClientInfo({
					siteSlug,
					changes: {
						opfsMountDescriptor: currentRuntimeMountDescriptor,
						opfsSync: {
							status: 'error',
							operation: syncOperation,
						},
					},
				})
			);
			throw error;
		}
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
 * Returns the setup params that should stay attached after an explicit save.
 *
 * Explicit saves open by site slug, but settings and sharing still need the
 * original setup URL. Start from the site record rather than `window.location`
 * so routing-only params from the current page are not persisted.
 */
function getSavedSetupUrlParams(
	siteInfo: SiteInfo
): NonNullable<SiteInfo['originalUrlParams']> {
	return getOriginalUrlParamsFromUrl(
		getSetupUrlFromSite(siteInfo, window.location.href)
	);
}

/**
 * Serializes repeated URL search params using the shape stored in site metadata.
 */
function getOriginalUrlParamsFromUrl(
	url: URL
): NonNullable<SiteInfo['originalUrlParams']> {
	const searchParams: Record<string, string | string[]> = {};
	for (const key of new Set(url.searchParams.keys())) {
		const value = url.searchParams.getAll(key);
		searchParams[key] = value.length > 1 ? value : value[0];
	}
	return {
		searchParams,
		hash: url.hash,
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
