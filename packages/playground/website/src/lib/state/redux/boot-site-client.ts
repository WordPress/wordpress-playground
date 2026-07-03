import { directoryHandleFromMountDevice } from '@wp-playground/storage';
import { loadDirectoryHandle } from '../opfs/opfs-directory-handle-storage';
import {
	getDirectoryPathForSlug,
	legacyOpfsPathSymbol,
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
} from './slice-ui';
import type { PlaygroundDispatch, PlaygroundReduxState } from './store';
import {
	isAutosavedSite,
	selectSiteBySlug,
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
		const site = selectSiteBySlug(getState(), siteSlug);

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
			} catch (e) {
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

		let isWordPressInstalled = false;
		let storedDirHandle: FileSystemDirectoryHandle | undefined;
		if (mountDescriptor) {
			try {
				storedDirHandle = await directoryHandleFromMountDevice(
					mountDescriptor.device
				);
				isWordPressInstalled =
					await playgroundAvailableInOpfs(storedDirHandle);
			} catch (e) {
				logger.error(e);
				if (e instanceof DOMException && e.name === 'NotFoundError') {
					dispatch(
						setActiveSiteError({
							error: 'directory-handle-not-found-in-indexeddb',
							details: e,
						})
					);
					return;
				}
				if (e instanceof DOMException && e.name === 'NotAllowedError') {
					dispatch(
						setActiveSiteError({
							error: 'directory-handle-permission-denied',
							details: e,
						})
					);
					return;
				}
				dispatch(
					setActiveSiteError({
						error: 'directory-handle-unknown-error',
						details: e,
					})
				);
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
			const coreFilesPresent =
				await opfsHasWordPressCoreFiles(storedDirHandle);
			if (!coreFilesPresent) {
				logger.error(
					'Saved Playground is missing core WordPress files; its ' +
						'initial save did not finish. Showing the incomplete-save notice.'
				);
				dispatch(setActiveSiteError({ error: 'incomplete-save' }));
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

			await startPlaygroundWeb({
				iframe: iframe!,
				remoteUrl: getRemoteUrl().toString(),
				scope: site.slug,
				// Keep the Playground's name on the loading screen the whole time
				// it boots, rather than only the changing "Preparing WordPress…".
				siteName: site.metadata.name,
				blueprint,
				extensions: phpExtensions,
				experimentalBlueprintsV2Runner:
					!isWordPressInstalled &&
					new URLSearchParams(window.location.search).get(
						'experimental-blueprints-v2-runner'
					) === 'yes',
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
}: {
	playground: PlaygroundClient;
	mountDescriptor: Omit<MountDescriptor, 'initialSyncDirection'>;
	siteSlug: string;
	operation: 'save' | 'autosave';
	dispatch: PlaygroundDispatch;
}) {
	let shouldReportProgress = true;
	try {
		await playground.mountOpfs(
			{
				...mountDescriptor,
				initialSyncDirection: 'memfs-to-opfs',
			},
			(progress: SyncProgress) => {
				if (!shouldReportProgress) {
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
		await dispatch(
			updateSiteMetadata({
				slug: siteSlug,
				changes: {
					initialOpfsSyncPending: false,
					whenLastUsed: Date.now(),
				},
			})
		);
		dispatch(
			updateClientInfo({
				siteSlug,
				changes: {
					opfsSync: undefined,
				},
			})
		);
	} catch (error: unknown) {
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

/**
 * Check if the given directory handle directory is a Playground directory.
 *
 * @TODO: Create a shared package like @wp-playground/wordpress for such utilities
 * and bring in the context detection logic from wp-now – only express it in terms of
 * either abstract FS operations or isomorphic PHP FS operations.
 * (we can't just use Node.js require('fs') in the browser, for example)
 *
 * @TODO: Reuse the "isWordPressInstalled" logic implemented in the boot protocol.
 *        Perhaps mount OPFS first, and only then check for the presence of the
 *        WordPress installation? Or, if not, perhaps implement a shared file access
 * 		  abstraction that can be used both with the PHP module and OPFS directory handles?
 *
 * @param dirHandle
 */
export async function playgroundAvailableInOpfs(
	dirHandle: FileSystemDirectoryHandle
) {
	// Run this loop just to trigger an exception if the directory handle is no good.
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	for await (const _ of dirHandle.keys()) {
		break;
	}

	try {
		/**
		 * Assume it's a Playground directory if these files exist:
		 * - wp-config.php
		 * - wp-content/database/.ht.sqlite
		 */
		await dirHandle.getFileHandle('wp-config.php', { create: false });
		const wpContent = await dirHandle.getDirectoryHandle('wp-content', {
			create: false,
		});
		const database = await wpContent.getDirectoryHandle('database', {
			create: false,
		});
		await database.getFileHandle('.ht.sqlite', { create: false });
	} catch {
		return false;
	}
	return true;
}

/**
 * Whether a stored Playground directory still holds the WordPress core files a
 * boot fatally depends on.
 *
 * `playgroundAvailableInOpfs` only proves a site was *started* here (wp-config.php
 * and the SQLite database exist); it can't tell a complete copy from a partial
 * one. A save interrupted mid-copy can keep wp-config.php while dropping core
 * files, and the next boot then fatals on the first missing `require()` (the
 * reported case was `wp-includes/sodium_compat/autoload.php`). Sampling a few
 * load-bearing files that every supported WordPress ships — one at the root, one
 * in wp-includes, and the sodium_compat entry that actually crashed — catches
 * that partial state. It's a heuristic (a partial copy could in principle retain
 * all of these), but a false negative just falls back to the generic boot-error
 * view, while the checked files are universal enough to avoid false positives.
 */
async function opfsHasWordPressCoreFiles(
	dirHandle: FileSystemDirectoryHandle
): Promise<boolean> {
	try {
		const wpIncludes = await dirHandle.getDirectoryHandle('wp-includes', {
			create: false,
		});
		const sodiumCompat = await wpIncludes.getDirectoryHandle(
			'sodium_compat',
			{ create: false }
		);
		await Promise.all([
			dirHandle.getFileHandle('wp-settings.php', { create: false }),
			wpIncludes.getFileHandle('version.php', { create: false }),
			sodiumCompat.getFileHandle('autoload.php', { create: false }),
		]);
	} catch {
		return false;
	}
	return true;
}
