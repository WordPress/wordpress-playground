import { directoryHandleFromMountDevice } from '@wp-playground/storage';
import { loadDirectoryHandle } from '../opfs/opfs-directory-handle-storage';
import {
	getDirectoryPathForSlug,
	legacyOpfsPathSymbol,
	opfsSiteStorage,
} from '../opfs/opfs-site-storage';
import {
	isTraversableFilesystemBackend,
	persistBlueprintBundle,
} from '../opfs/opfs-blueprint-bundle-storage';
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
import {
	resolveRemoteBlueprint,
	startPlaygroundWeb,
} from '@wp-playground/client';
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
	shouldResetInitialOpfsSync,
	type SiteInfo,
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
import { PHPMYADMIN_INSTALL_PATH } from '@wp-playground/tools';
import { phpExtensionQueryArgsToExtensionsArray } from '../url/php-extension-query';
import { applyQueryOverrides } from '../url/resolve-blueprint-from-url';

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
		let site = selectSiteBySlug(getState(), siteSlug);

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

		const needsInitialOpfsSync = shouldResetInitialOpfsSync(site);
		if (needsInitialOpfsSync) {
			try {
				site = await recoverInterruptedInitialOpfsSync(site, {
					dispatch,
					getState,
				});
			} catch (e) {
				logger.error(e);
				dispatch(
					setActiveSiteError({
						error: 'site-boot-failed',
						details: e,
					})
				);
				return;
			}
		}

		let isWordPressInstalled = false;
		if (mountDescriptor) {
			try {
				isWordPressInstalled = await playgroundAvailableInOpfs(
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
		const isFirstOpfsBoot = needsInitialOpfsSync && !isWordPressInstalled;
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
 * Restarts an interrupted first OPFS sync from the saved setup recipe.
 *
 * `initialOpfsSyncPending` means the OPFS copy never reached the point where
 * it could be trusted as a complete WordPress filesystem. A partial directory
 * can still contain `wp-config.php` and the SQLite database, so checking for
 * those files alone would boot from a corrupt snapshot. Drop the partial files
 * and let the normal first-boot path recreate WordPress, then sync it again.
 */
async function recoverInterruptedInitialOpfsSync(
	site: SiteInfo,
	{
		dispatch,
		getState,
	}: {
		dispatch: PlaygroundDispatch;
		getState: () => PlaygroundReduxState;
	}
) {
	site = await recoverRemoteBlueprintBundleIfNeeded(site, {
		dispatch,
		getState,
	});
	await opfsSiteStorage!.resetSiteFiles(site.slug);
	return site;
}

async function recoverRemoteBlueprintBundleIfNeeded(
	site: SiteInfo,
	{
		dispatch,
		getState,
	}: {
		dispatch: PlaygroundDispatch;
		getState: () => PlaygroundReduxState;
	}
) {
	const source = site.metadata.originalBlueprintSource;
	if (
		source?.type !== 'remote-url' ||
		isTraversableFilesystemBackend(site.metadata.originalBlueprint) ||
		!hasBundledResource(site.metadata.originalBlueprint)
	) {
		return site;
	}

	const recoveredBlueprint = await applyQueryOverrides(
		await resolveRemoteBlueprint(source.url),
		originalUrlParamsToSearchParams(site.originalUrlParams)
	);
	if (!isTraversableFilesystemBackend(recoveredBlueprint)) {
		return site;
	}
	await persistBlueprintBundle(site.slug, recoveredBlueprint);
	await dispatch(
		updateSite({
			slug: site.slug,
			changes: {
				metadata: {
					...site.metadata,
					originalBlueprint: recoveredBlueprint,
					originalBlueprintSource: {
						type: 'opfs-site',
					},
				},
			},
		})
	);
	return selectSiteBySlug(getState(), site.slug)!;
}

function originalUrlParamsToSearchParams(
	originalUrlParams: SiteInfo['originalUrlParams']
) {
	const searchParams = new URLSearchParams();
	for (const [key, value] of Object.entries(
		originalUrlParams?.searchParams ?? {}
	)) {
		const values = Array.isArray(value) ? value : [value];
		for (const item of values) {
			searchParams.append(key, item);
		}
	}
	return searchParams;
}

function hasBundledResource(value: unknown) {
	const stack = [value];
	while (stack.length) {
		const current = stack.pop();
		if (!current || typeof current !== 'object') {
			continue;
		}
		if (Array.isArray(current)) {
			stack.push(...current);
			continue;
		}
		if ((current as { resource?: unknown }).resource === 'bundled') {
			return true;
		}
		stack.push(...Object.values(current));
	}
	return false;
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
