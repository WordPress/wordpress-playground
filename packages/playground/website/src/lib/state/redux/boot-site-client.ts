import { loadDirectoryHandle } from '../opfs/opfs-directory-handle-storage';
import {
	getDirectoryPathForSlug,
	legacyOpfsPathSymbol,
	opfsSiteStorage,
} from '../opfs/opfs-site-storage';
import { addClientInfo, updateClientInfo } from './slice-clients';
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
} from './slice-ui';
import type { PlaygroundDispatch, PlaygroundReduxState } from './store';
import {
	isAutosavedSite,
	isUnfinishedBlueprintRun,
	selectSiteBySlug,
	updateSite,
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
import { PHPMYADMIN_PATH_ALIAS } from '@wp-playground/tools';
import { phpExtensionQueryArgsToExtensionsArray } from '../url/php-extension-query';
import { runSiteFirstBootInitializer } from './site-first-boot-initializer';
import { captureAndPersistSiteThumbnail } from './capture-site-thumbnail';

const PENDING_OPFS_SITE_REMOVAL_RETRY_DELAYS_MS = [700, 1400];

/**
 * Loads Playground in an iframe.
 *
 * Aborts any stale async writes once the iframe gets removed, as acknowledged
 * by the AbortSignal.
 */
export function bootSiteClient(
	siteSlug: string,
	iframe: HTMLIFrameElement,
	{ signal }: { signal: AbortSignal }
) {
	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		if (signal.aborted) {
			return;
		}
		let site = selectSiteBySlug(getState(), siteSlug);
		if (!site) {
			dispatch(
				setActiveSiteError({
					error: 'site-boot-failed',
					details: new Error(`Site not found: ${siteSlug}`),
				})
			);
			return;
		}

		if (site?.metadata.storage === 'opfs') {
			if (site.metadata.opfsSiteRemovalPending) {
				const removalResult = await finishPendingOpfsSiteRemoval({
					siteSlug,
					dispatch,
					signal,
				});
				if (signal.aborted) {
					return;
				}
				if (false === removalResult) {
					// `finishPendingOpfsSiteRemoval()` already retried and
					// dispatched `browser-storage-cleanup-failed`. Stop here
					// so we do not mount OPFS while it may still contain the
					// previous autosave's WordPress files.
					return;
				}
				site = selectSiteBySlug(getState(), siteSlug) ?? site;
			} else if (
				site.loadedFromStorage === true &&
				site.metadata.initialOpfsSyncPending === true
			) {
				// If the initial OPFS sync was interrupted, the site files are incomplete
				// and we can't boot this site.
				dispatch(
					setActiveSiteError({
						error: 'initial-opfs-sync-interrupted',
					})
				);
				return;
			}
		}

		let mountDescriptor = undefined;
		if (site.metadata.storage === 'opfs') {
			mountDescriptor = {
				device: {
					type: 'opfs',
					// @TODO: Remove backcompat code after 2024-12-01.
					path: (site.metadata as any)[legacyOpfsPathSymbol]
						? (site.metadata as any)[legacyOpfsPathSymbol]
						: getDirectoryPathForSlug(site.slug),
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
					setActiveSiteError({
						error: 'directory-handle-not-found-in-indexeddb',
						details: e,
					})
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

		const opfsInitialSyncPending =
			site.metadata.storage === 'opfs' &&
			site.metadata.initialOpfsSyncPending === true;
		const shouldBootFromStoredFiles =
			site.metadata.storage === 'local-fs' ||
			(site.metadata.storage === 'opfs' && !opfsInitialSyncPending);

		logTrackingEvent('load');

		let blueprint: Blueprint;
		if (shouldBootFromStoredFiles) {
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
			blueprint = site.metadata.originalBlueprint as Blueprint;
		}

		// PHP-only mode: a Blueprint with `preferredVersions.wp: false`
		// declares it does not want WordPress. Respect that on a first OPFS
		// boot too, where there are no stored files to mount yet.
		const blueprintRequestedNoWordPress =
			blueprint &&
			!isBlueprintBundle(blueprint) &&
			'preferredVersions' in blueprint &&
			blueprint.preferredVersions?.wp === false;
		// Stored WordPress files cannot use `do-not-attempt-installing`:
		// that mode is for PHP-only boots and returns before the worker loads
		// the SQLite drop-in. Use the existing-files mode so saved SQLite
		// sites boot from their database, while incomplete first OPFS saves
		// are still blocked above by `initialOpfsSyncPending`.
		const wordpressInstallMode = blueprintRequestedNoWordPress
			? 'do-not-attempt-installing'
			: shouldBootFromStoredFiles
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
			!shouldBootFromStoredFiles;
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

			await startPlaygroundWeb({
				iframe: iframe!,
				remoteUrl: getRemoteUrl().toString(),
				scope: site.slug,
				blueprint,
				extensions: phpExtensions,
				// Intercept the Playground client even if the
				// Blueprint fails.
				onClientConnected: (playgroundClient) => {
					if (signal.aborted) {
						return;
					}
					playground = (window as any)['playground'] =
						playgroundClient;
				},
				// Log Blueprint events
				onBlueprintValidated: logBlueprintEvents,
				mounts,
				wordpressInstallMode,
				corsProxy: corsProxyUrl,
				gitAdditionalHeadersCallback: createGitAuthHeaders(),
				pathAliases: [PHPMYADMIN_PATH_ALIAS],
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
				dispatch(
					setActiveSiteError({
						error: 'github-artifact-expired',
						details: e,
					})
				);
			} else if (e instanceof BlueprintFilesystemRequiredError) {
				dispatch(
					setActiveSiteError({
						error: 'blueprint-filesystem-required',
						details: e,
					})
				);
			} else if (e instanceof InvalidBlueprintError) {
				dispatch(
					setActiveSiteError({
						error: 'blueprint-validation-failed',
						details: e,
					})
				);
			} else if (
				(e as any).name === 'ResourceUnavailableError' ||
				(e as any).originalErrorClassName === 'ResourceUnavailableError'
			) {
				dispatch(
					setActiveSiteError({
						error: 'resource-unavailable',
						details: e,
					})
				);
			} else if (firewallError) {
				dispatch(
					setActiveSiteError({
						error: 'network-firewall-interference',
						details: firewallError,
					})
				);
			} else if (findDownloadErrorInCauseChain(e)) {
				dispatch(
					setActiveSiteError({
						error: 'resource-download-failed',
						details: e,
					})
				);
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
					if (isUnfinishedBlueprintRun(site)) {
						dispatch(
							setActiveSiteError({
								error: 'site-boot-failed',
								details: e,
							})
						);
					}
					dispatch(
						setActiveModal(modalSlugs.GITHUB_PRIVATE_REPO_AUTH)
					);
				} else {
					dispatch(
						setActiveSiteError({
							error: 'site-boot-failed',
							details: e,
						})
					);
					dispatch(setActiveModal(modalSlugs.ERROR_REPORT));
				}
			} else {
				dispatch(
					setActiveSiteError({
						error: 'site-boot-failed',
						details: e,
					})
				);
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
		try {
			await runSiteFirstBootInitializer(site.slug, connectedPlayground);
		} catch (error) {
			if (signal.aborted) {
				return;
			}
			logger.error('Error initializing Playground', error);
			if (mountDescriptorForInitialOpfsSync) {
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
			return;
		}
		// When metadata says the first OPFS copy is still pending, install
		// WordPress in MEMFS and copy it into OPFS in the background. Otherwise
		// the stored files are mounted and boot can only refresh recency metadata.
		if (mountDescriptorForInitialOpfsSync) {
			void syncInitialOpfsFilesInBackground({
				playground: connectedPlayground,
				mountDescriptor: mountDescriptorForInitialOpfsSync,
				siteSlug: site.slug,
				operation: syncOperation,
				dispatch,
				signal,
				siteSlugToReturnToIfBlueprintFails:
					site.metadata.siteSlugToReturnToIfBlueprintFails,
			}).then((syncSucceeded) => {
				if (!syncSucceeded) {
					return;
				}
				void captureAndPersistSiteThumbnail({
					playground: connectedPlayground,
					siteSlug: site.slug,
					dispatch,
					getState,
					signal,
				});
			});
		} else {
			try {
				const metadataChanges = {
					...(site.metadata.storage !== 'none'
						? { whenLastUsed: Date.now() }
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
				if (signal.aborted) {
					return;
				}
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
			if (site.metadata.storage !== 'none') {
				void captureAndPersistSiteThumbnail({
					playground: connectedPlayground,
					siteSlug: site.slug,
					dispatch,
					getState,
					signal,
				});
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

		if (site.urlToRestoreAfterRuntimeSettingsChange) {
			const urlToRestore = site.urlToRestoreAfterRuntimeSettingsChange;
			await dispatch(
				updateSite({
					slug: site.slug,
					changes: {
						urlToRestoreAfterRuntimeSettingsChange: undefined,
					},
				})
			);
			if (signal.aborted) {
				return;
			}
			if (urlToRestore.startsWith('/')) {
				const restoreBaseUrl = 'https://playground.internal';
				const parsedUrlToRestore = new URL(
					urlToRestore,
					restoreBaseUrl
				);
				// Restore only paths inside this Playground. The URL parser
				// catches protocol-relative URLs and browser backslash
				// normalization quirks while preserving valid slashes in the
				// path, query, and hash.
				if (parsedUrlToRestore.origin === restoreBaseUrl) {
					await connectedPlayground.goTo(
						`${parsedUrlToRestore.pathname}${parsedUrlToRestore.search}${parsedUrlToRestore.hash}`
					);
				}
			}
		}
	};
}

/**
 * Finishes a same-site autosave reset started by an older Playground build.
 *
 * Those builds wrote `opfsSiteRemovalPending` after replacing the setup metadata
 * but before deleting the previous WordPress files. Boot must still honor that
 * persisted marker or it can mount files that do not match `wp-runtime.json`.
 */
async function finishPendingOpfsSiteRemoval({
	siteSlug,
	dispatch,
	signal,
}: {
	siteSlug: string;
	dispatch: PlaygroundDispatch;
	signal: AbortSignal;
}): Promise<boolean> {
	if (!opfsSiteStorage) {
		dispatch(
			setActiveSiteError({
				error: 'browser-storage-cleanup-failed',
				details: new Error(
					'Cannot finish resetting the saved Playground because browser storage is not available.'
				),
			})
		);
		return false;
	}

	// Another Playground tab can keep OPFS entries locked long enough for
	// the first cleanup attempt to fail. Retry before showing the modal; only
	// ask the user to close tabs and reload after two more browser refusals.
	let cleanupError: unknown;
	for (
		let attempt = 0;
		attempt <= PENDING_OPFS_SITE_REMOVAL_RETRY_DELAYS_MS.length;
		attempt++
	) {
		try {
			await opfsSiteStorage.removeWordPressFilesKeepMetadata(siteSlug);
			if (signal.aborted) {
				return false;
			}

			await dispatch(
				updateSiteMetadata({
					slug: siteSlug,
					changes: {
						opfsSiteRemovalPending: undefined,
					},
				})
			);
			return true;
		} catch (error) {
			if (signal.aborted) {
				return false;
			}
			cleanupError = error;
		}

		const retryDelay = PENDING_OPFS_SITE_REMOVAL_RETRY_DELAYS_MS[attempt];
		if (retryDelay === undefined) {
			break;
		}
		await waitForPendingOpfsSiteRemovalRetry(retryDelay, signal);
		if (signal.aborted) {
			return false;
		}
	}

	logger.error(
		'Error finishing pending Playground reset cleanup',
		cleanupError
	);
	dispatch(
		setActiveSiteError({
			error: 'browser-storage-cleanup-failed',
			details: cleanupError,
		})
	);
	return false;
}

function waitForPendingOpfsSiteRemovalRetry(
	delayMs: number,
	signal: AbortSignal
): Promise<void> {
	if (signal.aborted) {
		return Promise.resolve();
	}

	return new Promise((resolve) => {
		const timeout = setTimeout(done, delayMs);
		signal.addEventListener('abort', done, { once: true });

		function done() {
			clearTimeout(timeout);
			signal.removeEventListener('abort', done);
			resolve();
		}
	});
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
	siteSlugToReturnToIfBlueprintFails,
}: {
	playground: PlaygroundClient;
	mountDescriptor: Omit<MountDescriptor, 'initialSyncDirection'>;
	siteSlug: string;
	operation: 'save' | 'autosave';
	dispatch: PlaygroundDispatch;
	signal: AbortSignal;
	siteSlugToReturnToIfBlueprintFails?: string;
}): Promise<boolean> {
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
			return false;
		}
		// Clear the return target in the same metadata write that completes the
		// initial copy so failed copies retain their recovery action.
		await dispatch(
			updateSiteMetadata({
				slug: siteSlug,
				changes: {
					initialOpfsSyncPending: false,
					whenLastUsed: Date.now(),
					...(siteSlugToReturnToIfBlueprintFails
						? { siteSlugToReturnToIfBlueprintFails: undefined }
						: {}),
				},
			})
		);
		if (signal.aborted) {
			return false;
		}
		dispatch(
			updateClientInfo({
				siteSlug,
				changes: {
					opfsSync: undefined,
				},
			})
		);
		return true;
	} catch (error: unknown) {
		if (signal.aborted) {
			return false;
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
		return false;
	} finally {
		// Progress is reported from a worker. Once the sync settles, ignore any
		// queued progress message so it cannot overwrite the final UI state.
		shouldReportProgress = false;
	}
}
