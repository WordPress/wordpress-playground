import { directoryHandleFromMountDevice } from '@wp-playground/storage';
import { loadDirectoryHandle } from '../opfs/opfs-directory-handle-storage';
import {
	getDirectoryPathForSite,
	opfsSiteStorage,
} from '../opfs/opfs-site-storage';
import {
	addClientInfo,
	removeClientInfo,
	updateClientInfo,
} from './slice-clients';
import { logBlueprintEvents, logTrackingEvent } from '../../tracking';
import {
	type Blueprint,
	BlueprintFilesystemRequiredError,
	InvalidBlueprintError,
	isBlueprintBundle,
} from '@wp-playground/blueprints';
import { logger } from '@php-wasm/logger';
import { type SyncProgress, setupPostMessageRelay } from '@php-wasm/web';
import { startPlaygroundWeb } from '@wp-playground/client';
import type { MountDescriptor, PlaygroundClient } from '@wp-playground/remote';
import { getRemoteUrl } from '../../config';
import {
	setActiveModal,
	setActiveSiteError,
	setGitHubAuthRepoUrl,
	type SiteError,
} from './slice-ui';
import type { PlaygroundDispatch, PlaygroundReduxState } from './store';
import {
	isAutosavedSite,
	selectSiteBySlug,
	type SiteInfo,
	updateSiteMetadata,
} from './slice-sites';
// @ts-ignore
import { corsProxyUrl } from 'virtual:cors-proxy-url';
import { modalSlugs } from './slice-ui';
import {
	createGitAuthHeaders,
	shouldShowGitHubAuthModal,
} from '../../../github/git-auth-helpers';
import {
	findFirewallErrorInCauseChain,
	findDownloadErrorInCauseChain,
} from './error-utils';
import { PHPMYADMIN_INSTALL_PATH } from '@wp-playground/tools';
import { phpExtensionQueryArgsToExtensionsArray } from '../url/php-extension-query';
import {
	isFileSystemPermissionError,
	isMissingFileSystemEntryError,
	storedDirectoryHasPlaygroundFiles,
	storedDirectoryHasWordPressCoreFiles,
} from './wordpress-core-file-check';

export function bootSiteClient(
	siteSlug: string,
	iframe: HTMLIFrameElement,
	{ signal }: { signal: AbortSignal }
) {
	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		signal.onabort = () => {
			dispatch(removeClientInfo(siteSlug));
		};
		const setBootSiteError = (error: SiteError, details?: unknown) =>
			setActiveSiteError({ siteSlug, error, details });
		let site = selectSiteBySlug(getState(), siteSlug);
		if (!site) {
			dispatch(
				setBootSiteError(
					'site-boot-failed',
					new Error(`Site not found: ${siteSlug}`)
				)
			);
			return;
		}
		if (signal.aborted) {
			return;
		}

		if (
			site.metadata.storage === 'opfs' &&
			site.metadata.opfsResetPending
		) {
			if (!opfsSiteStorage) {
				dispatch(
					setBootSiteError(
						'directory-handle-unknown-error',
						new Error(
							'Cannot finish resetting the saved Playground because browser storage is not available.'
						)
					)
				);
				return;
			}
			try {
				await opfsSiteStorage.resetSiteFiles(site.slug);
				if (signal.aborted) {
					return;
				}
			} catch (error) {
				if (signal.aborted) {
					return;
				}
				logger.error(error);
				if (isFileSystemPermissionError(error)) {
					dispatch(
						setBootSiteError(
							'directory-handle-permission-denied',
							error
						)
					);
					return;
				}
				dispatch(
					setBootSiteError('directory-handle-unknown-error', error)
				);
				return;
			}
			try {
				await dispatch(
					updateSiteMetadata({
						slug: site.slug,
						changes: {
							opfsResetPending: undefined,
						},
					})
				);
				site = selectSiteBySlug(getState(), siteSlug) ?? site;
			} catch (error) {
				logger.error(
					'Error clearing pending Playground reset marker',
					error
				);
				if (isFileSystemPermissionError(error)) {
					dispatch(
						setBootSiteError(
							'directory-handle-permission-denied',
							error
						)
					);
					return;
				}
				dispatch(
					setBootSiteError('directory-handle-unknown-error', error)
				);
				return;
			}
		}

		let mountDescriptor = undefined;
		if (site.metadata.storage === 'opfs') {
			mountDescriptor = {
				device: {
					type: 'opfs',
					path: getDirectoryPathForSite(site),
				},
				mountpoint: '/wordpress',
			} as const;
		} else if (site.metadata.storage === 'local-fs') {
			let localDirectoryHandle;
			try {
				localDirectoryHandle = await loadDirectoryHandle(site.slug);
				if (signal.aborted) {
					return;
				}
			} catch (e) {
				if (signal.aborted) {
					return;
				}
				logger.error(e);
				dispatch(
					setBootSiteError(
						'directory-handle-not-found-in-indexeddb',
						e
					)
				);
				return;
			}
			mountDescriptor = {
				device: {
					type: 'local-fs',
					handle: localDirectoryHandle,
				},
				mountpoint: '/wordpress',
			} as const;
		}

		let isWordPressInstalled = false;
		let storedDirHandle: FileSystemDirectoryHandle | undefined;
		if (mountDescriptor) {
			try {
				storedDirHandle = await directoryHandleFromMountDevice(
					mountDescriptor.device
				);
				isWordPressInstalled =
					await storedDirectoryHasPlaygroundFiles(storedDirHandle);
				if (signal.aborted) {
					return;
				}
			} catch (e) {
				if (signal.aborted) {
					return;
				}
				logger.error(e);
				if (isMissingFileSystemEntryError(e)) {
					dispatch(
						setBootSiteError(
							'directory-handle-not-found-in-indexeddb',
							e
						)
					);
					return;
				}
				if (isFileSystemPermissionError(e)) {
					dispatch(
						setBootSiteError(
							'directory-handle-permission-denied',
							e
						)
					);
					return;
				}
				dispatch(setBootSiteError('directory-handle-unknown-error', e));
				return;
			}
		}

		// A stored save that looks installed (wp-config.php + the SQLite database
		// are present) but is missing load-bearing WordPress core files is a
		// partial copy whose initial save never finished — a tab closed or power
		// lost mid-copy. Those core files only ever lived in the running tab's
		// memory, so there is nothing left to recover. Be upfront and stop here
		// instead of booting into a fatal require() of a missing core file.
		if (isWordPressInstalled && storedDirHandle) {
			let coreFilesPresent: boolean;
			try {
				coreFilesPresent = await storedDirectoryHasWordPressCoreFiles(
					storedDirHandle,
					site.metadata.runtimeConfiguration.wpVersion
				);
			} catch (error) {
				if (signal.aborted) {
					return;
				}
				logger.error(error);
				if (isFileSystemPermissionError(error)) {
					dispatch(
						setBootSiteError(
							'directory-handle-permission-denied',
							error
						)
					);
					return;
				}
				dispatch(
					setBootSiteError('directory-handle-unknown-error', error)
				);
				return;
			}
			if (signal.aborted) {
				return;
			}
			if (!coreFilesPresent) {
				logger.error(
					'Saved Playground is missing core WordPress files; its ' +
						'initial save did not finish. Showing the incomplete-save notice.'
				);
				dispatch(setBootSiteError('incomplete-save'));
				return;
			}
		}

		logTrackingEvent('load');

		let blueprint: Blueprint;
		if (isWordPressInstalled) {
			blueprint = {
				preferredVersions: {
					php: site.metadata.runtimeConfiguration.phpVersion,
					wp: site.metadata.runtimeConfiguration.wpVersion,
				},
				features: {
					intl: site.metadata.runtimeConfiguration.intl,
					networking: site.metadata.runtimeConfiguration.networking,
				},
				extraLibraries: site.metadata.runtimeConfiguration
					.extraLibraries as any[],
				constants: {
					...site.metadata.runtimeConfiguration.constants,
					...site.metadata.playgroundDefinedConstants,
				},
			};
		} else {
			blueprint = site.metadata.originalBlueprint;
		}

		// PHP-only mode: a Blueprint with `preferredVersions.wp: false`
		// declares it doesn't want WordPress, so honor that even if the
		// storage layer thinks WP isn't installed yet.
		const blueprintRequestedNoWordPress =
			blueprint &&
			!isBlueprintBundle(blueprint) &&
			blueprint.preferredVersions?.wp === false;
		const wordpressInstallMode = blueprintRequestedNoWordPress
			? 'do-not-attempt-installing'
			: isWordPressInstalled
				? 'install-from-existing-files-if-needed'
				: 'download-and-install';

		/**
		 * On the first boot, we must allow WordPress installation in MEMFS
		 * so it can get synchronized to OPFS on Save or Autosave.
		 * Only then, on subsequent boots, we can synchronize WordPress files
		 * back from OPFS to MEMFS.
		 */
		const isFirstOpfsBoot =
			site.metadata.initialOpfsSyncPending === true &&
			site.metadata.storage === 'opfs' &&
			!isWordPressInstalled;
		const mounts: MountDescriptor[] = [];
		let mountDescriptorForInitialOpfsSync: typeof mountDescriptor =
			undefined;
		if (mountDescriptor) {
			if (isFirstOpfsBoot) {
				mountDescriptorForInitialOpfsSync = mountDescriptor;
			} else {
				mounts.push({
					...mountDescriptor,
					initialSyncDirection: 'opfs-to-memfs',
				});
			}
		}

		let playground: PlaygroundClient | undefined = undefined;
		try {
			const phpExtensions = phpExtensionQueryArgsToExtensionsArray(
				site.originalUrlParams?.searchParams?.['php-extension'],
				document.location.href
			);
			const experimentalBlueprintsV2Runner =
				!isWordPressInstalled &&
				getSetupSearchParam(
					site,
					'experimental-blueprints-v2-runner'
				) === 'yes';

			await startPlaygroundWeb({
				iframe: iframe!,
				remoteUrl: getRemoteUrl().toString(),
				scope: site.slug,
				blueprint,
				extensions: phpExtensions,
				experimentalBlueprintsV2Runner,
				// Intercept the Playground client even if the
				// Blueprint fails.
				onClientConnected: (playgroundClient) => {
					playground = (window as any)['playground'] =
						playgroundClient;
				},
				// Log Blueprint events
				onBlueprintValidated: logBlueprintEvents,
				mounts,
				wordpressInstallMode,
				corsProxy: corsProxyUrl,
				gitAdditionalHeadersCallback: createGitAuthHeaders(),
				pathAliases: [
					{
						urlPrefix: '/phpmyadmin',
						fsPath: PHPMYADMIN_INSTALL_PATH,
					},
				],
			});
		} catch (e) {
			if (signal.aborted) {
				return;
			}
			logger.error(e);
			logTrackingEvent('error', { source: 'bootSiteClient' });

			const firewallError = findFirewallErrorInCauseChain(e);
			if (
				(e as any).name === 'ArtifactExpiredError' ||
				(e as any).originalErrorClassName === 'ArtifactExpiredError'
			) {
				dispatch(setBootSiteError('github-artifact-expired', e));
			} else if (e instanceof BlueprintFilesystemRequiredError) {
				dispatch(setBootSiteError('blueprint-filesystem-required', e));
			} else if (e instanceof InvalidBlueprintError) {
				dispatch(setBootSiteError('blueprint-validation-failed', e));
			} else if (firewallError) {
				dispatch(
					setBootSiteError(
						'network-firewall-interference',
						firewallError
					)
				);
			} else if (findDownloadErrorInCauseChain(e)) {
				dispatch(setBootSiteError('resource-download-failed', e));
			} else if (
				(e as any).name === 'GitAuthenticationError' ||
				(e as any).originalErrorClassName ===
					'GitAuthenticationError' ||
				(e as any).cause?.name === 'GitAuthenticationError'
			) {
				const repoUrl =
					(e as any).repoUrl ||
					(e as any).cause?.repoUrl ||
					undefined;

				if (shouldShowGitHubAuthModal(repoUrl)) {
					if (repoUrl) {
						dispatch(setGitHubAuthRepoUrl(repoUrl));
					}
					dispatch(
						setActiveModal(modalSlugs.GITHUB_PRIVATE_REPO_AUTH)
					);
				} else {
					dispatch(setBootSiteError('site-boot-failed', e));
					dispatch(setActiveModal(modalSlugs.ERROR_REPORT));
				}
			} else {
				dispatch(setBootSiteError('site-boot-failed', e));
			}
			// Don't continue to client setup after an error
			return;
		}

		if (signal.aborted || !playground) {
			return;
		}
		const connectedPlayground = playground as PlaygroundClient;

		setupPostMessageRelay(iframe, document.location.origin);

		const syncOperation = isAutosavedSite(site) ? 'autosave' : 'save';
		dispatch(
			addClientInfo({
				siteSlug: site.slug,
				url: '/',
				client: connectedPlayground,
				opfsMountDescriptor: mountDescriptor,
				opfsSync: mountDescriptorForInitialOpfsSync
					? {
							status: 'syncing',
							operation: syncOperation,
						}
					: undefined,
			})
		);
		// `initialOpfsSyncPending` is a recovery flag, not the source of truth.
		// If OPFS already contains WordPress files, the initial sync either
		// completed earlier or is no longer needed. Clear the stale flag so
		// future boots mount OPFS normally.
		const hasStaleInitialOpfsSyncPendingFlag =
			site.metadata.initialOpfsSyncPending === true &&
			site.metadata.storage === 'opfs' &&
			isWordPressInstalled;

		if (mountDescriptorForInitialOpfsSync) {
			void syncInitialOpfsFilesInBackground({
				playground: connectedPlayground,
				mountDescriptor: mountDescriptorForInitialOpfsSync,
				siteSlug: site.slug,
				operation: syncOperation,
				dispatch,
				signal,
			});
		} else {
			try {
				const metadataChanges = {
					...(site.metadata.storage !== 'none'
						? { whenLastUsed: Date.now() }
						: {}),
					...(hasStaleInitialOpfsSyncPendingFlag
						? { initialOpfsSyncPending: false }
						: {}),
				};
				if (Object.keys(metadataChanges).length > 0) {
					await dispatch(
						updateSiteMetadata({
							slug: site.slug,
							changes: metadataChanges,
						})
					);
				}
			} catch (error) {
				logger.error('Error updating Playground metadata', error);
				dispatch(
					updateClientInfo({
						siteSlug: site.slug,
						changes: {
							opfsSync: {
								status: 'error',
								operation: syncOperation,
							},
						},
					})
				);
			}
		}

		connectedPlayground.onNavigation((url) => {
			if (signal.aborted) {
				return;
			}
			dispatch(
				updateClientInfo({
					siteSlug: site.slug,
					changes: {
						url,
					},
				})
			);
		});

		signal.onabort = null;
	};
}

function getSetupSearchParam(site: SiteInfo, name: string) {
	const storedValue = site.originalUrlParams?.searchParams?.[name];
	if (Array.isArray(storedValue)) {
		return storedValue[0];
	}
	if (storedValue !== undefined) {
		return storedValue;
	}
	return new URLSearchParams(window.location.search).get(name) ?? undefined;
}

/**
 * Copies files created during a saved site's first boot from MEMFS into OPFS.
 *
 * The iframe is already usable when this runs. Redux keeps showing sync
 * progress until the copy succeeds, then future boots can mount OPFS normally.
 */
async function syncInitialOpfsFilesInBackground({
	playground,
	mountDescriptor,
	siteSlug,
	operation,
	dispatch,
	signal,
}: {
	playground: PlaygroundClient;
	mountDescriptor: Omit<MountDescriptor, 'initialSyncDirection'>;
	siteSlug: string;
	operation: 'save' | 'autosave';
	dispatch: PlaygroundDispatch;
	signal: AbortSignal;
}) {
	let shouldReportProgress = true;
	try {
		// The first OPFS copy can outlive the iframe that started it. Once the
		// viewport aborts, stale worker progress must not recreate client state
		// that the unmount cleanup already removed.
		await playground.mountOpfs(
			{
				...mountDescriptor,
				initialSyncDirection: 'memfs-to-opfs',
			},
			(progress: SyncProgress) => {
				if (!shouldReportProgress || signal.aborted) {
					return;
				}
				dispatch(
					updateClientInfo({
						siteSlug,
						changes: {
							opfsSync: {
								status: 'syncing',
								progress,
								operation,
							},
						},
					})
				);
			}
		);
		if (signal.aborted) {
			return;
		}
		await dispatch(
			updateSiteMetadata({
				slug: siteSlug,
				changes: {
					initialOpfsSyncPending: false,
					whenLastUsed: Date.now(),
				},
			})
		);
		if (signal.aborted) {
			return;
		}
		dispatch(
			updateClientInfo({
				siteSlug,
				changes: {
					opfsSync: undefined,
				},
			})
		);
	} catch (error: unknown) {
		if (signal.aborted) {
			return;
		}
		logger.error('Error syncing saved Playground to OPFS', error);
		dispatch(
			updateClientInfo({
				siteSlug,
				changes: {
					opfsSync: {
						status: 'error',
						operation,
					},
				},
			})
		);
		return;
	} finally {
		// Progress is reported from a worker. Once the sync settles, ignore any
		// queued progress message so it cannot overwrite the final UI state.
		shouldReportProgress = false;
	}
}
