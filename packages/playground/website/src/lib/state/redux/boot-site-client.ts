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
	type BlueprintDeclaration,
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
import { isPlaygroundDirectory } from '../../is-playground-directory';

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
		if (mountDescriptor) {
			try {
				isWordPressInstalled = await isPlaygroundDirectory(
					await directoryHandleFromMountDevice(mountDescriptor.device)
				);
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
			blueprint = site.metadata.originalBlueprint as Blueprint;
		}

		// PHP-only mode: a Blueprint with `preferredVersions.wp: false`
		// declares it doesn't want WordPress, so honor that even if the
		// storage layer thinks WP isn't installed yet.
		const blueprintRequestedNoWordPress =
			blueprint &&
			!isBlueprintBundle(blueprint) &&
			'preferredVersions' in blueprint &&
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
		const isFirstPersistentBoot =
			(site.metadata.initialSyncPending === true ||
				site.metadata.initialOpfsSyncPending === true) &&
			(site.metadata.storage === 'opfs' ||
				(site.metadata.storage === 'local-fs' &&
					!isWordPressInstalled));
		const mounts: MountDescriptor[] = [];
		let mountDescriptorForInitialSync: typeof mountDescriptor = undefined;
		if (mountDescriptor) {
			if (isFirstPersistentBoot) {
				mountDescriptorForInitialSync = mountDescriptor;
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
				onBlueprintValidated: logSupportedBlueprintEvents,
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
				opfsSync: mountDescriptorForInitialSync
					? {
							status: 'syncing',
							operation: syncOperation,
						}
					: undefined,
			})
		);
		// `initialSyncPending` is a recovery flag, not the source of truth.
		// If local-fs already contains WordPress files, the initial sync either
		// completed earlier or is no longer needed. Clear the stale flag so
		// future boots mount local-fs normally.
		const hasStaleInitialSyncPendingFlag =
			(site.metadata.initialSyncPending === true ||
				site.metadata.initialOpfsSyncPending === true) &&
			site.metadata.storage === 'local-fs' &&
			isWordPressInstalled;

		if (mountDescriptorForInitialSync) {
			void syncInitialFilesInBackground({
				playground: connectedPlayground,
				mountDescriptor: mountDescriptorForInitialSync,
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
					...(hasStaleInitialSyncPendingFlag
						? {
								initialSyncPending: false,
								initialOpfsSyncPending: false,
							}
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

function logSupportedBlueprintEvents(blueprint: BlueprintDeclaration) {
	if ('version' in blueprint && blueprint.version === 2) {
		return;
	}
	return logBlueprintEvents(blueprint as any);
}

/**
 * Copies files created during a saved site's first boot from MEMFS into OPFS.
 *
 * The iframe is already usable when this runs. Redux keeps showing sync
 * progress until the copy succeeds, then future boots can mount OPFS normally.
 */
async function syncInitialFilesInBackground({
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
					initialSyncPending: false,
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
