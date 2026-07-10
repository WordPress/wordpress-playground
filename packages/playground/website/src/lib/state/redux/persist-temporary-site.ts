import { logger } from '@php-wasm/logger';
import type { MountDescriptor, PlaygroundClient } from '@wp-playground/remote';
import type { PHPConstants } from '@wp-playground/blueprints';
import { saveDirectoryHandle } from '../opfs/opfs-directory-handle-storage';
import {
	opfsSiteStorage,
	getDirectoryPathForSlug,
	legacyOpfsPathSymbol,
} from '../opfs/opfs-site-storage';
import {
	deletePersistedBlueprintBundleVersion,
	isTraversableFilesystemBackend,
	persistBlueprintBundle,
} from '../opfs/opfs-blueprint-bundle-storage';
import type { TraversableFilesystemBackend } from '@wp-playground/storage';
import type { PlaygroundReduxState } from './store';
import type store from './store';
import {
	removeClientInfo,
	selectClientBySiteSlug,
	selectClientInfoBySiteSlug,
	updateClientInfo,
} from './slice-clients';
import {
	commitSiteUpdateWhileLocked,
	getAuthoritativeSiteWhileLocked,
	selectSiteBySlug,
	serializeAutosaveLifecycle,
	serializeSiteUpdate,
	sitesSlice,
	type SiteInfo,
	type SitePersistence,
} from './slice-sites';
import { PlaygroundRoute, redirectTo } from '../url/router';
import type { SiteStorageType } from './slice-sites';
import { setActiveModal } from './slice-ui';
import {
	getRuntimeBootFingerprint,
	getSetupUrlFromSite,
} from '../playground-identity';
import {
	abortSiteBoot,
	acquireSiteRuntimeLock,
	getCurrentSiteBootSignal,
	releaseSiteRuntimeLock,
} from '../site-runtime-lock';

type PersistTemporarySiteOptions = {
	localFsHandle?: FileSystemDirectoryHandle;
	siteName?: string;
	skipRenameModal?: boolean;
	persistence?: SitePersistence;
	updateUrl?: boolean;
};

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
	options: PersistTemporarySiteOptions = {}
) {
	return async (
		dispatch: typeof store.dispatch,
		getState: () => PlaygroundReduxState
	) => {
		/** Keeps the full storage transition inside the per-site transaction. */
		const persist = () =>
			serializeSiteUpdate(siteSlug, () =>
				persistTemporarySiteWhileLocked(
					siteSlug,
					storageType,
					options,
					dispatch,
					getState
				)
			);
		return options.persistence === 'autosave'
			? serializeAutosaveLifecycle(persist)
			: persist();
	};
}

/**
 * Runs a storage transition while the site update queue is held.
 *
 * The queue covers the first state read, filesystem mount, metadata commit, and
 * client-state commit so a setup replacement cannot observe a half-saved site.
 */
async function persistTemporarySiteWhileLocked(
	siteSlug: string,
	storageType: Extract<SiteStorageType, 'opfs' | 'local-fs'>,
	options: PersistTemporarySiteOptions,
	dispatch: typeof store.dispatch,
	getState: () => PlaygroundReduxState
) {
	const stateBeforeAuthoritativeRead = getState();
	const localSiteBeforeAuthoritativeRead = selectSiteBySlug(
		stateBeforeAuthoritativeRead,
		siteSlug
	);
	if (!localSiteBeforeAuthoritativeRead) {
		throw new Error(`Cannot find site ${siteSlug} to save.`);
	}
	const clientInfo = selectClientInfoBySiteSlug(
		stateBeforeAuthoritativeRead,
		siteSlug
	);
	const playground =
		clientInfo?.client ??
		selectClientBySiteSlug(stateBeforeAuthoritativeRead, siteSlug);
	if (!playground) {
		throw new Error(
			`Site ${siteSlug} must have an active client to be saved, but none was found.`
		);
	}
	const bootSignal = getCurrentSiteBootSignal(siteSlug);
	/** Checks that late mount callbacks still belong to the captured iframe. */
	const stillOwnsActiveClient = () => {
		const currentState = getState();
		const selectedClient =
			selectClientInfoBySiteSlug(currentState, siteSlug)?.client ??
			selectClientBySiteSlug(currentState, siteSlug);
		return (
			selectedClient === playground &&
			(!bootSignal || getCurrentSiteBootSignal(siteSlug) === bootSignal)
		);
	};
	const siteInfo = await getAuthoritativeSiteWhileLocked(siteSlug, getState);
	if (!siteInfo) {
		throw new Error(`Cannot find site ${siteSlug} to save.`);
	}
	if (
		options.persistence === 'autosave' &&
		siteInfo.metadata.storage !== 'none'
	) {
		// An explicit save may have won this site's queue after autosave was
		// requested. Do not turn that user-preserved site back into an autosave.
		return;
	}
	const stateAfterAuthoritativeRead = getState();
	const currentClient =
		selectClientInfoBySiteSlug(stateAfterAuthoritativeRead, siteSlug)
			?.client ??
		selectClientBySiteSlug(stateAfterAuthoritativeRead, siteSlug);
	const currentLocalSite = selectSiteBySlug(
		stateAfterAuthoritativeRead,
		siteSlug
	);
	if (
		bootSignal?.aborted ||
		currentClient !== playground ||
		!currentLocalSite ||
		!siteMatchesSetupRevision(
			localSiteBeforeAuthoritativeRead,
			currentLocalSite
		) ||
		!siteMatchesSetupRevision(localSiteBeforeAuthoritativeRead, siteInfo)
	) {
		throw new Error(
			`Cannot save ${siteSlug}; its active Playground setup changed.`
		);
	}
	const previousMountDescriptor = clientInfo?.opfsMountDescriptor;
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
			const existingSiteInfo = await opfsSiteStorage?.read(siteInfo.slug);
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
	if (
		isTraversableFilesystemBackend(originalBlueprint) &&
		siteInfo.metadata.originalBlueprintSource?.type !== 'opfs-site'
	) {
		// An opfs-site backend is already a durable bundle version. Do not create
		// another identical version merely because site storage is changing.
		bundleToPersist = originalBlueprint;
	}

	let persistedBundle:
		| Awaited<ReturnType<typeof persistBlueprintBundle>>
		| undefined;

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
	const siteBeforeMount = selectSiteBySlug(getState(), siteSlug);
	if (
		!stillOwnsActiveClient() ||
		!siteBeforeMount ||
		!siteMatchesSetupRevision(siteInfo, siteBeforeMount)
	) {
		throw new Error(
			`Cannot save ${siteSlug}; its active Playground changed while storage was selected.`
		);
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
	let acquiredRuntimeLockForSave = false;
	let mountAttempted = false;
	let currentRuntimeMountDescriptor:
		| typeof mountDescriptor
		| typeof previousMountDescriptor
		| undefined = previousMountDescriptor;
	try {
		if (bundleToPersist) {
			persistedBundle = await persistBlueprintBundle(
				siteSlug,
				bundleToPersist,
				undefined,
				(siteInfo.metadata as any)[legacyOpfsPathSymbol]
			);
		}
		const siteAfterBundleCopy = selectSiteBySlug(getState(), siteSlug);
		if (
			!stillOwnsActiveClient() ||
			!siteAfterBundleCopy ||
			!siteMatchesSetupRevision(siteInfo, siteAfterBundleCopy)
		) {
			throw new Error(
				`Cannot save ${siteSlug}; its active Playground changed while the Blueprint bundle was copied.`
			);
		}
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
			// Report existing persistence failures before asking the remote to
			// detach. `unmountOpfs()` performs a second commit-boundary flush and
			// leaves the mount attached if writes arriving in between cannot flush.
			await playground.flushOpfs(mountDescriptor.mountpoint);
			try {
				await playground.unmountOpfs(mountDescriptor.mountpoint);
			} catch (error) {
				if (
					!(await isMountStillActiveAfterUnmountError(
						playground,
						mountDescriptor.mountpoint
					))
				) {
					currentRuntimeMountDescriptor = undefined;
					restorePreviousMount = Boolean(previousMountDescriptor);
				}
				throw error;
			}
			currentRuntimeMountDescriptor = undefined;
			restorePreviousMount = Boolean(previousMountDescriptor);
		}
		const siteAfterOldMountDetach = selectSiteBySlug(getState(), siteSlug);
		if (
			!stillOwnsActiveClient() ||
			!siteAfterOldMountDetach ||
			!siteMatchesSetupRevision(siteInfo, siteAfterOldMountDetach)
		) {
			throw new Error(
				`Cannot save ${siteSlug}; its active Playground changed before mounting storage.`
			);
		}
		if (storageType === 'opfs' && isTemporarySite) {
			if (!bootSignal && navigator.locks) {
				throw new Error(
					`Cannot find the active Playground boot: ${siteSlug}`
				);
			}
			if (bootSignal) {
				await acquireSiteRuntimeLock(siteSlug, bootSignal);
				if (
					bootSignal.aborted ||
					getCurrentSiteBootSignal(siteSlug) !== bootSignal
				) {
					await releaseSiteRuntimeLock(bootSignal);
					throw new Error(
						`Cannot save ${siteSlug}; its active Playground changed.`
					);
				}
			}
			acquiredRuntimeLockForSave = true;
		}
		mountAttempted = true;
		await playground.mountOpfs(
			{
				...mountDescriptor,
				initialSyncDirection: 'memfs-to-opfs',
			},
			(progress) => {
				if (!stillOwnsActiveClient()) {
					return;
				}
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
		const latestState = getState();
		const latestClient =
			selectClientInfoBySiteSlug(latestState, siteSlug)?.client ??
			selectClientBySiteSlug(latestState, siteSlug);
		const latestSite = selectSiteBySlug(latestState, siteSlug);
		if (
			bootSignal?.aborted ||
			latestClient !== playground ||
			!latestSite ||
			!siteMatchesSetupRevision(siteInfo, latestSite)
		) {
			throw new Error(
				`Cannot finish saving ${siteSlug}; its active Playground setup changed.`
			);
		}

		const persistedAt = Date.now();
		const playgroundDefinedConstants =
			await getPlaygroundDefinedPHPConstants(playground);
		const siteBeforeCommit = selectSiteBySlug(getState(), siteSlug);
		if (
			!stillOwnsActiveClient() ||
			!siteBeforeCommit ||
			!siteMatchesSetupRevision(siteInfo, siteBeforeCommit)
		) {
			throw new Error(
				`Cannot finish saving ${siteSlug}; its active Playground changed before metadata commit.`
			);
		}
		const siteChanges: Partial<SiteInfo> = {
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
				...siteInfo.metadata,
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
				...(persistedBundle
					? {
							originalBlueprint: persistedBundle.backend,
							originalBlueprintSource: {
								type: 'opfs-site' as const,
								directory: persistedBundle.directory,
							},
						}
					: {}),
				...(trimmedName ? { name: trimmedName } : {}),
			},
		};
		await commitSiteUpdateWhileLocked(
			{
				slug: siteSlug,
				changes: siteChanges,
			},
			dispatch,
			getState
		);
		if (isAutosave && !stillOwnsActiveClient()) {
			await restartRuntimeReplacedDuringSaveCommit(
				siteSlug,
				dispatch,
				getState
			);
		}
		if (
			storageType === 'local-fs' &&
			previousMountDescriptor?.device.type === 'opfs'
		) {
			if (bootSignal) {
				await releaseSiteRuntimeLock(bootSignal);
			}
		}

		// @TODO: Create a notification to tell the user the operation is complete
		if (stillOwnsActiveClient()) {
			dispatch(
				updateClientInfo({
					siteSlug,
					changes: {
						opfsMountDescriptor: mountDescriptor,
						opfsSync: undefined,
					},
				})
			);
		}
	} catch (error) {
		let detachedFailedMount = false;
		let discardedClientForRecovery = false;
		if (
			mountAttempted &&
			currentRuntimeMountDescriptor !== mountDescriptor
		) {
			try {
				await playground.unmountOpfs(mountDescriptor.mountpoint);
				detachedFailedMount = true;
			} catch (unmountFailedMountError) {
				if (
					await isMountStillActiveAfterUnmountError(
						playground,
						mountDescriptor.mountpoint
					)
				) {
					currentRuntimeMountDescriptor = mountDescriptor;
					restorePreviousMount = false;
				} else {
					detachedFailedMount = true;
				}
				logger.error(
					'Error detaching a failed browser-storage mount.',
					unmountFailedMountError
				);
			}
		}
		if (currentRuntimeMountDescriptor === mountDescriptor) {
			try {
				await playground.unmountOpfs(mountDescriptor.mountpoint);
				currentRuntimeMountDescriptor = undefined;
				restorePreviousMount = Boolean(previousMountDescriptor);
				detachedFailedMount = true;
			} catch (unmountNewMountError) {
				if (
					!(await isMountStillActiveAfterUnmountError(
						playground,
						mountDescriptor.mountpoint
					))
				) {
					currentRuntimeMountDescriptor = undefined;
					restorePreviousMount = Boolean(previousMountDescriptor);
					detachedFailedMount = true;
				}
				logger.error(
					'Error unmounting storage after save failure.',
					unmountNewMountError
				);
			}
		}
		let previousMountRestorationFailed = false;
		if (
			restorePreviousMount &&
			previousMountDescriptor &&
			stillOwnsActiveClient()
		) {
			try {
				await playground.mountOpfs({
					...previousMountDescriptor,
					// The old mount was flushed before it was detached. Another
					// tab may have changed its durable files while this save ran,
					// so restoration must pull from storage instead of overwriting it
					// with this tab's now-stale MEMFS.
					initialSyncDirection: 'opfs-to-memfs',
				});
				currentRuntimeMountDescriptor = previousMountDescriptor;
			} catch (restoreError) {
				previousMountRestorationFailed = true;
				logger.error(
					'Error restoring the previous storage mount after save failure.',
					restoreError
				);
			}
		} else if (restorePreviousMount && previousMountDescriptor) {
			// A replacement iframe owns this slug now. Never remount the old
			// client's filesystem or publish its descriptor into the new client.
			discardedClientForRecovery = true;
			if (bootSignal) {
				await releaseSiteRuntimeLock(bootSignal);
			}
		}
		if (previousMountRestorationFailed) {
			discardedClientForRecovery = true;
			const failedRuntimeStillOwnsSite =
				bootSignal !== undefined &&
				getCurrentSiteBootSignal(siteSlug) === bootSignal;
			if (failedRuntimeStillOwnsSite) {
				abortSiteBoot(siteSlug);
			}
			if (bootSignal) {
				await releaseSiteRuntimeLock(bootSignal);
			}
			if (failedRuntimeStillOwnsSite) {
				dispatch(removeClientInfo(siteSlug));
			}
			const recoverySite = failedRuntimeStillOwnsSite
				? selectSiteBySlug(getState(), siteSlug)
				: undefined;
			if (recoverySite) {
				// Force a fresh iframe. Its first boot reconciles this local-only
				// generation with durable metadata before mounting any files.
				dispatch(
					sitesSlice.actions.updateSite({
						id: siteSlug,
						changes: {
							metadata: {
								...recoverySite.metadata,
								whenCreated: Math.max(
									Date.now(),
									(recoverySite.metadata.whenCreated ?? 0) + 1
								),
							},
						},
					})
				);
			}
		}
		if (acquiredRuntimeLockForSave && detachedFailedMount) {
			if (bootSignal) {
				await releaseSiteRuntimeLock(bootSignal);
			}
		}
		if (!discardedClientForRecovery && stillOwnsActiveClient()) {
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
		}
		if (persistedBundle) {
			await removeInactiveBundleAfterFailedSave(
				siteSlug,
				persistedBundle,
				siteInfo
			);
		}
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
}

/**
 * Conservatively checks whether a failed unmount left its journal attached.
 *
 * A failed state query is treated as mounted so callers keep the descriptor and
 * runtime lease rather than allowing destructive work to overlap the journal.
 */
async function isMountStillActiveAfterUnmountError(
	playground: PlaygroundClient,
	mountpoint: string
): Promise<boolean> {
	try {
		return await playground.hasOpfsMount(mountpoint);
	} catch (error) {
		logger.error(
			'Could not verify the OPFS mount after unmount failed.',
			error
		);
		return true;
	}
}

/** Removes a save's staged bundle only when durable metadata did not select it. */
async function removeInactiveBundleAfterFailedSave(
	siteSlug: string,
	persistedBundle: Awaited<ReturnType<typeof persistBlueprintBundle>>,
	previousSite: SiteInfo
): Promise<void> {
	if (!opfsSiteStorage) {
		return;
	}
	let durableSite: SiteInfo | undefined;
	try {
		durableSite = await opfsSiteStorage.read(siteSlug);
	} catch {
		// An unreadable record might already select this version. Keep it for
		// recovery rather than turning a metadata failure into missing resources.
		return;
	}
	const selectedSource = durableSite?.metadata.originalBlueprintSource;
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
				(durableSite?.metadata as any)?.[legacyOpfsPathSymbol] ??
				(previousSite.metadata as any)[legacyOpfsPathSymbol]
		);
	} catch (error) {
		logger.error(
			`Could not remove inactive Blueprint bundle for ${siteSlug}.`,
			error
		);
	}
}

/**
 * Stops a replacement that booted from metadata made obsolete by this save.
 *
 * The durable commit cannot be cancelled after it starts. If a new iframe took
 * ownership while that write was in flight, it may already be running the old
 * temporary setup without the newly selected OPFS mount. Abort only that exact
 * replacement, remove its client, and commit a newer viewport generation so
 * the next boot reads the authoritative saved metadata.
 */
async function restartRuntimeReplacedDuringSaveCommit(
	siteSlug: string,
	dispatch: typeof store.dispatch,
	getState: () => PlaygroundReduxState
): Promise<void> {
	const replacementState = getState();
	const replacementClient =
		selectClientInfoBySiteSlug(replacementState, siteSlug)?.client ??
		selectClientBySiteSlug(replacementState, siteSlug);
	const replacementSignal = getCurrentSiteBootSignal(siteSlug);
	if (!replacementClient && !replacementSignal) {
		return;
	}

	if (
		replacementSignal &&
		getCurrentSiteBootSignal(siteSlug) === replacementSignal
	) {
		abortSiteBoot(siteSlug);
	}
	const currentState = getState();
	const currentClient =
		selectClientInfoBySiteSlug(currentState, siteSlug)?.client ??
		selectClientBySiteSlug(currentState, siteSlug);
	if (replacementClient && currentClient === replacementClient) {
		dispatch(removeClientInfo(siteSlug));
	}
	if (replacementSignal) {
		await releaseSiteRuntimeLock(replacementSignal);
	}

	const committedSite = selectSiteBySlug(getState(), siteSlug);
	if (!committedSite) {
		return;
	}
	const nextWhenCreated = Math.max(
		Date.now(),
		(committedSite.metadata.whenCreated ?? 0) + 1
	);
	try {
		await commitSiteUpdateWhileLocked(
			{
				slug: siteSlug,
				changes: {
					metadata: {
						whenCreated: nextWhenCreated,
					},
				},
			},
			dispatch,
			getState
		);
	} catch (error) {
		// The save itself is already durable. A local generation still forces
		// boot to reconcile that record even when persisting the remount token
		// fails; treating this as an ordinary save failure would leave no client.
		logger.error(
			`Could not persist the recovery generation for ${siteSlug}.`,
			error
		);
		const currentSite = selectSiteBySlug(getState(), siteSlug);
		if (currentSite?.metadata.id === committedSite.metadata.id) {
			dispatch(
				sitesSlice.actions.updateSite({
					id: siteSlug,
					changes: {
						metadata: {
							...currentSite.metadata,
							whenCreated: nextWhenCreated,
						},
					},
				})
			);
		}
	}
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

/**
 * Checks whether two site records describe the iframe setup captured by save.
 *
 * Usage metadata may change while saving. The durable owner, viewport
 * generation, source setup, and runtime options may not: mixing either side of
 * those boundaries would copy files from one setup into another site's record.
 */
function siteMatchesSetupRevision(left: SiteInfo, right: SiteInfo) {
	return (
		left.metadata.id === right.metadata.id &&
		left.metadata.whenCreated === right.metadata.whenCreated &&
		left.metadata.sourceSetupUrlFingerprint ===
			right.metadata.sourceSetupUrlFingerprint &&
		getRuntimeBootFingerprint(left.metadata.runtimeConfiguration) ===
			getRuntimeBootFingerprint(right.metadata.runtimeConfiguration)
	);
}
