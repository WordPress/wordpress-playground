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
	selectClientInfoBySiteSlug,
} from './slice-clients';
import { logBlueprintEvents, logTrackingEvent } from '../../tracking';
import {
	type Blueprint,
	BlueprintFilesystemRequiredError,
	InvalidBlueprintError,
} from '@wp-playground/blueprints';
import { logger } from '@php-wasm/logger';
import { setupPostMessageRelay } from '@php-wasm/web';
import { startPlaygroundWeb } from '@wp-playground/client';
import type { PlaygroundClient } from '@wp-playground/remote';
import { getRemoteUrl } from '../../config';
import {
	setActiveModal,
	setActiveSiteError,
	setGitHubAuthRepoUrl,
} from './slice-ui';
import type { PlaygroundDispatch, PlaygroundReduxState } from './store';
import { selectSiteBySlug } from './slice-sites';
// @ts-ignore
import { corsProxyUrl } from 'virtual:cors-proxy-url';
import { modalSlugs } from './slice-ui';
import {
	createGitAuthHeaders,
	shouldShowGitHubAuthModal,
} from '../../../github/git-auth-helpers';
import { findFirewallErrorInCauseChain } from './error-utils';
import { autoSaveSiteToOpfs } from './auto-save-site';
import {
	initTabCoordinator,
	checkForExistingTabs,
	requestStaleTabsShutdown,
	setDependentMode,
} from './tab-coordinator';

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

		// Initialize tab coordination so this tab can respond to pings
		// from other tabs opening the same site. We do this for all
		// storage types because a temporary site may be auto-saved to
		// OPFS during this session, and the coordinator needs to be
		// running before that happens.
		initTabCoordinator(
			site.slug,
			// onShutdownRequested — another tab asked us to close
			(reason) => {
				dispatch(
					setActiveSiteError({
						error: 'tab-superseded',
						details: new Error(reason),
					})
				);
			},
			// onTakeoverRequested — another tab is becoming main,
			// we switch to dependent mode
			() => {
				enterDependentMode(
					site.slug,
					iframe,
					dispatch,
					getState,
					signal
				);
			},
			// onBackupRequested — not implemented in playground-website
			undefined,
			// onSiteReset — site was deleted in another tab, reload fresh
			() => {
				window.location.href =
					window.location.origin + window.location.pathname;
			}
		);

		// For already-persisted sites, check whether another tab is
		// already running the same site. If so, enter dependent mode
		// to prevent data corruption from concurrent OPFS writes.
		if (site.metadata.storage !== 'none') {
			const { existingTabs, hasFreshTab, hasStaleTab } =
				await checkForExistingTabs(site.slug);

			if (hasStaleTab) {
				requestStaleTabsShutdown(existingTabs);
			}

			if (hasFreshTab) {
				// Another fresh tab already owns this site. Enter
				// dependent mode: point the iframe at the existing
				// service worker scope instead of starting a second
				// PHP worker.
				const existingClient = selectClientInfoBySiteSlug(
					getState(),
					site.slug
				);
				if (existingClient?.isDependentMode) {
					return;
				}

				enterDependentMode(
					site.slug,
					iframe,
					dispatch,
					getState,
					signal
				);
				return;
			}
		}

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
				constants: site.metadata.runtimeConfiguration.constants,
				// Preserve the original landing page so returning visitors
				// arrive at the same page they saw on first boot.
				landingPage:
					site.metadata.originalBlueprint?.landingPage,
			};
		} else {
			blueprint = site.metadata.originalBlueprint;
		}

		let playground: PlaygroundClient | undefined = undefined;
		try {
			await startPlaygroundWeb({
				iframe: iframe!,
				remoteUrl: getRemoteUrl().toString(),
				scope: site.slug,
				blueprint,
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
				mounts: mountDescriptor
					? [
							{
								...mountDescriptor,
								initialSyncDirection: 'opfs-to-memfs',
							},
						]
					: [],
				shouldInstallWordPress: !isWordPressInstalled,
				corsProxy: corsProxyUrl,
				gitAdditionalHeadersCallback: createGitAuthHeaders(),
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

		setupPostMessageRelay(iframe, document.location.origin);

		dispatch(
			addClientInfo({
				siteSlug: site.slug,
				url: '/',
				client: playground,
				opfsMountDescriptor: mountDescriptor,
			})
		);

		// Auto-save temporary sites to OPFS in the background.
		// Don't await — this runs without blocking the user.
		if (site.metadata.storage === 'none') {
			dispatch(autoSaveSiteToOpfs(site.slug));
		}

		(playground as PlaygroundClient).onNavigation((url) => {
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
 * Enters dependent mode: instead of starting a new PHP worker, the iframe
 * is pointed at the existing service worker scope so the user gets a live
 * view of the site owned by another tab. OPFS is NOT mounted — the main
 * tab handles all filesystem writes.
 */
function enterDependentMode(
	siteSlug: string,
	iframe: HTMLIFrameElement,
	dispatch: PlaygroundDispatch,
	getState: () => PlaygroundReduxState,
	signal: AbortSignal
) {
	const remoteUrl = getRemoteUrl();
	const scopedSiteUrl = `/scope:${encodeURIComponent(siteSlug)}/`;
	const scopedUrl = new URL(scopedSiteUrl, remoteUrl);
	scopedUrl.pathname += 'wp-admin/';
	iframe.src = scopedUrl.toString();

	const dependentModeClient = {
		goTo: async (path: string) => {
			const newUrl = new URL(
				scopedSiteUrl + path.replace(/^\//, ''),
				remoteUrl
			);
			iframe.src = newUrl.toString();
		},
		getCurrentURL: async () => {
			try {
				const iframeUrl = new URL(
					iframe.contentWindow?.location?.href || ''
				);
				return iframeUrl.pathname.replace(
					new RegExp(
						`^${scopedSiteUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
					),
					'/'
				);
			} catch {
				return '/';
			}
		},
	} as PlaygroundClient;

	dispatch(
		addClientInfo({
			siteSlug,
			url: '/wp-admin/',
			client: dependentModeClient,
			opfsMountDescriptor: undefined,
			isDependentMode: true,
		})
	);

	const handleIframeNavigation = () => {
		try {
			const iframeHref = iframe.contentWindow?.location?.href;
			if (iframeHref) {
				const iframeUrl = new URL(iframeHref);
				const path = iframeUrl.pathname.replace(
					new RegExp(
						`^${scopedSiteUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
					),
					'/'
				);
				dispatch(
					updateClientInfo({
						siteSlug,
						changes: { url: path },
					})
				);
			}
		} catch {
			// Cross-origin access denied
		}
	};

	iframe.addEventListener('load', handleIframeNavigation);
	signal.onabort = () => {
		iframe.removeEventListener('load', handleIframeNavigation);
		dispatch(removeClientInfo(siteSlug));
	};

	setDependentMode(true);
	logger.info(
		'Playground running in dependent mode — reusing existing service worker from another tab'
	);
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
