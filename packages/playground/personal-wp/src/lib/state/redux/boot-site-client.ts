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
import {
	type Blueprint,
	type BlueprintV1Declaration,
	BlueprintFilesystemRequiredError,
	InvalidBlueprintError,
} from '@wp-playground/blueprints';
import { logger } from '@php-wasm/logger';
import { setupPostMessageRelay } from '@php-wasm/web';
import { startPlaygroundWeb } from '@wp-playground/client';
import type { PlaygroundClient } from '@wp-playground/remote';
import { getRemoteUrl } from '../../config';
import { setActiveSiteError } from './slice-ui';
import type { PlaygroundDispatch, PlaygroundReduxState } from './store';
import {
	selectSiteBySlug,
	updateSiteMetadata,
	selectBlueprintResolvedFromUrl,
	setBlueprintResolvedFromUrl,
} from './slice-sites';
// @ts-ignore
import { corsProxyUrl } from 'virtual:cors-proxy-url';
import { findFirewallErrorInCauseChain } from './error-utils';
import {
	initTabCoordinator,
	checkForExistingTabs,
	requestStaleTabsShutdown,
	setDependentMode,
	requestTakeover,
} from './tab-coordinator';

export interface BootSiteClientOptions {
	signal: AbortSignal;
	/** Clear URL search params and hash after applying a URL blueprint */
	clearUrlAfterBlueprintApplied?: boolean;
	/** Auto-login when WordPress is already installed */
	autoLogin?: boolean;
}

export function bootSiteClient(
	siteSlug: string,
	iframe: HTMLIFrameElement,
	options: BootSiteClientOptions
) {
	const {
		signal,
		clearUrlAfterBlueprintApplied = false,
		autoLogin = false,
	} = options;

	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		signal.onabort = () => {
			dispatch(removeClientInfo(siteSlug));
		};
		const site = selectSiteBySlug(getState(), siteSlug);

		// Check for URL blueprint from redux (set when URL has params like ?plugin=friends)
		const urlBlueprint = selectBlueprintResolvedFromUrl(getState());
		const hasUrlBlueprint =
			urlBlueprint && urlBlueprint.targetSiteSlug === site.slug;

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

		// Initialize tab coordinator for multi-tab detection
		// Only for persistent sites - temporary sites don't need coordination
		if (site.metadata.storage !== 'none') {
			initTabCoordinator(
				site.slug,
				(reason) => {
					dispatch(
						setActiveSiteError({
							error: 'tab-superseded',
							details: new Error(reason),
						})
					);
				},
				() => {
					// This callback is called when another tab requests to take over as main
					// We switch to dependent mode without showing an error
					const remoteUrl = getRemoteUrl();
					const scopedSiteUrl = `/scope:${encodeURIComponent(site.slug)}/`;

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
						updateClientInfo({
							siteSlug: site.slug,
							changes: {
								client: dependentModeClient,
								isDependentMode: true,
								opfsMountDescriptor: undefined,
							},
						})
					);

					setDependentMode(true);

					logger.info(
						'Switched to dependent mode - another tab has taken over as main'
					);
				},
				undefined,
				() => {
					// Site was reset by another tab - reload to start fresh
					window.location.href =
						window.location.origin + window.location.pathname;
				}
			);

			const { existingTabs, hasFreshTab, hasStaleTab } =
				await checkForExistingTabs(site.slug);

			if (hasStaleTab) {
				requestStaleTabsShutdown(existingTabs);
			}

			if (hasFreshTab) {
				const urlParams = new URLSearchParams(window.location.search);
				const hasBlueprintUrl = !!urlParams.get('blueprint-url');
				const pendingBlueprintForCheck =
					selectBlueprintResolvedFromUrl(getState());
				const hasPendingBlueprintForSite =
					pendingBlueprintForCheck &&
					pendingBlueprintForCheck.targetSiteSlug === site.slug;
				const needsMainMode =
					hasBlueprintUrl || hasPendingBlueprintForSite;

				if (needsMainMode) {
					await requestTakeover(site.slug);
				} else {
					const existingClient = selectClientInfoBySiteSlug(
						getState(),
						site.slug
					);
					if (existingClient?.isDependentMode) {
						return;
					}

					const remoteUrl = getRemoteUrl();
					const scopedSiteUrl = `/scope:${encodeURIComponent(site.slug)}/`;
					const scopedUrl = new URL(scopedSiteUrl, remoteUrl);

					const dependentUrlParams = new URLSearchParams(
						window.location.search
					);
					const landingPage =
						dependentUrlParams.get('url') ||
						site.metadata.lastUrl ||
						'/wp-admin/';
					scopedUrl.pathname += landingPage.replace(/^\//, '');
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
							siteSlug: site.slug,
							url: landingPage,
							client: dependentModeClient,
							opfsMountDescriptor: undefined,
							isDependentMode: true,
						})
					);

					const handleIframeNavigation = () => {
						try {
							const iframeHref =
								iframe.contentWindow?.location?.href;
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
										siteSlug: site.slug,
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
						iframe.removeEventListener(
							'load',
							handleIframeNavigation
						);
						dispatch(removeClientInfo(site.slug));
					};

					dispatch(
						updateSiteMetadata({
							slug: site.slug,
							changes: {
								lastAccessDate: Date.now(),
							},
						})
					);

					logger.info(
						'Playground running in dependent mode - reusing existing service worker from another tab'
					);
					return;
				}
			}
		}

		let blueprint: Blueprint;
		if (isWordPressInstalled) {
			// Use URL param landing page if present, otherwise restore last URL
			const urlParamLandingPage = new URLSearchParams(
				window.location.search
			).get('url');

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
				login: autoLogin,
				// Restore last visited URL (pending blueprint may override below)
				landingPage: urlParamLandingPage || site.metadata.lastUrl,
			};

			// Merge URL blueprint (e.g., ?plugin=friends) into boot blueprint
			if (hasUrlBlueprint) {
				const resolved = urlBlueprint.blueprint;
				const current = blueprint as BlueprintV1Declaration;
				blueprint = {
					...blueprint,
					...(resolved.plugins?.length
						? { plugins: resolved.plugins }
						: {}),
					landingPage: resolved.landingPage || current.landingPage,
					steps: [
						...(current.steps || []),
						...(resolved.steps || []),
					],
				};
			}
		} else {
			blueprint = site.metadata.originalBlueprint;
		}

		// Check if we're in recovery mode (Health Check troubleshooting).
		// Recovery mode uses 'do-not-attempt-installing' to skip the
		// isWordPressInstalled() check that would load WordPress and crash
		// due to a broken plugin.
		const urlBlueprintLandingPage = hasUrlBlueprint
			? urlBlueprint.blueprint.landingPage
			: undefined;
		const isRecoveryMode = urlBlueprintLandingPage?.includes(
			'health-check-disable-plugin-hash'
		);

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
				// In recovery mode, skip the WordPress install check to avoid
				// loading WordPress before blueprint steps run.
				wordpressInstallMode: isRecoveryMode
					? 'do-not-attempt-installing'
					: undefined,
				// Intercept the Playground client even if the
				// Blueprint fails.
				onClientConnected: (playgroundClient) => {
					playground = (window as any)['playground'] =
						playgroundClient;
				},
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
			});
		} catch (e) {
			logger.error(e);
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
			} else {
				dispatch(
					setActiveSiteError({
						error: 'site-boot-failed',
						details: e,
					})
				);
			}
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

		(playground as PlaygroundClient).onNavigation((url) => {
			dispatch(
				updateClientInfo({
					siteSlug: site.slug,
					changes: {
						url,
					},
				})
			);
			dispatch(
				updateSiteMetadata({
					slug: site.slug,
					changes: { lastUrl: url },
				})
			);
		});

		// Clear URL blueprint after successful boot
		if (hasUrlBlueprint) {
			dispatch(setBlueprintResolvedFromUrl(null));
			if (clearUrlAfterBlueprintApplied) {
				const cleanUrl = new URL(window.location.href);
				cleanUrl.search = '';
				cleanUrl.hash = '';
				window.history.replaceState({}, '', cleanUrl.toString());
			}
		}

		signal.onabort = null;
	};
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
