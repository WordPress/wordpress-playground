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
	isBlueprintBundle,
} from '@wp-playground/blueprints';
import { logger } from '@php-wasm/logger';
import { setupPostMessageRelay } from '@php-wasm/web';
import { startPlaygroundWeb } from '@wp-playground/client';
import { ProgressTracker } from '@php-wasm/progress';
import type { ProgressDetails, ProgressTrackerEvent } from '@php-wasm/progress';
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
import {
	findFirewallErrorInCauseChain,
	findDownloadErrorInCauseChain,
} from './error-utils';
import { initTabCoordinator, destroyTabCoordinator } from './tab-coordinator';
import { isAppBasePath } from '../url/app-base-url';
import { PLAYGROUND_QUERY_KEYS } from '../url/router';
import { getBrowserPathAsLandingPage } from '../url/landing-page';

export interface BootSiteClientOptions {
	signal: AbortSignal;
	/** Clear URL search params and hash after applying a URL blueprint */
	clearUrlAfterBlueprintApplied?: boolean;
	/** Auto-login when WordPress is already installed */
	autoLogin?: boolean;
	/** Receive boot progress events from the Playground client */
	onProgress?: (progress: ProgressDetails) => void;
	/** Called when the iframe is ready to be shown */
	onReady?: () => void;
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
		onProgress,
		onReady,
	} = options;

	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		signal.onabort = () => {
			destroyTabCoordinator();
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

		// Only one tab may run the Personal WP runtime at a time. Other tabs
		// preserve their iframe and observe the browser-managed main-tab locks.
		if (site.metadata.storage !== 'none') {
			const tabInfo = await initTabCoordinator(site.slug, {
				onMainTabStatusChange: (mainTabStatus) => {
					if (!selectClientInfoBySiteSlug(getState(), site.slug)) {
						return;
					}
					dispatch(
						updateClientInfo({
							siteSlug: site.slug,
							changes: { mainTabStatus },
						})
					);
				},
				onSiteReset: () => {
					window.location.href =
						window.location.origin + window.location.pathname;
				},
			});

			if (tabInfo.isDependentMode) {
				bootDependentModeClient({
					siteSlug: site.slug,
					iframe,
					dispatch,
					getState,
					signal,
					mainTabStatus: tabInfo.mainTabStatus || 'missing',
					onReady,
				});
				logger.info(
					'Playground running in dependent mode - using the main tab worker'
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
				login: autoLogin,
				// Use the browser URL path + query as the landing page
				// when it points at a reflected WordPress route.
				landingPage: getBrowserPathAsLandingPage(),
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

		// PHP-only mode: a Blueprint with `preferredVersions.wp: false`
		// declares it doesn't want WordPress, so honor that even if the
		// storage layer thinks WP isn't installed yet.
		const blueprintRequestedNoWordPress =
			!!blueprint &&
			!isBlueprintBundle(blueprint) &&
			blueprint.preferredVersions?.wp === false;

		// Check if we're in recovery mode (Health Check troubleshooting).
		// In recovery mode, skip the WordPress install check to avoid
		// loading WordPress before blueprint steps run. The check would
		// load WordPress and crash due to a broken plugin.
		const urlBlueprintLandingPage = hasUrlBlueprint
			? urlBlueprint.blueprint.landingPage
			: undefined;
		const isRecoveryMode = urlBlueprintLandingPage?.includes(
			'health-check-disable-plugin-hash'
		);
		const wordpressInstallMode =
			blueprintRequestedNoWordPress || isRecoveryMode
				? 'do-not-attempt-installing'
				: isWordPressInstalled
					? 'install-from-existing-files-if-needed'
					: 'download-and-install';

		let playground: PlaygroundClient | undefined = undefined;
		const progressTracker = new ProgressTracker();
		progressTracker.addEventListener(
			'progress',
			(event: ProgressTrackerEvent) => {
				onProgress?.({
					progress: event.detail.progress,
					caption: event.detail.caption,
				});
			}
		);
		progressTracker.addEventListener('done', () => {
			onReady?.();
		});
		try {
			await startPlaygroundWeb({
				iframe: iframe!,
				remoteUrl: getRemoteUrl().toString(),
				scope: site.slug,
				blueprint,
				disableProgressBar: true,
				progressTracker,
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
				mounts: mountDescriptor
					? [
							{
								...mountDescriptor,
								initialSyncDirection: 'opfs-to-memfs',
							},
						]
					: [],
				wordpressInstallMode,
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
			} else if (findDownloadErrorInCauseChain(e)) {
				dispatch(
					setActiveSiteError({
						error: 'resource-download-failed',
						details: e,
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
			destroyTabCoordinator();
			return;
		}

		setupPostMessageRelay(iframe, document.location.origin);

		dispatch(
			addClientInfo({
				siteSlug: site.slug,
				url: '/',
				client: playground,
				opfsMountDescriptor: mountDescriptor,
				isDependentMode: false,
				mainTabStatus: 'booting',
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
		});

		// Clear URL blueprint after successful boot
		if (hasUrlBlueprint) {
			dispatch(setBlueprintResolvedFromUrl(null));
			if (clearUrlAfterBlueprintApplied) {
				const cleanUrl = new URL(window.location.href);
				if (isAppBasePath(cleanUrl.pathname)) {
					for (const key of PLAYGROUND_QUERY_KEYS) {
						cleanUrl.searchParams.delete(key);
					}
				}
				cleanUrl.hash = '';
				window.history.replaceState({}, '', cleanUrl.toString());
			}
		}

		signal.onabort = () => {
			destroyTabCoordinator();
			dispatch(removeClientInfo(site.slug));
		};
	};
}

function bootDependentModeClient({
	siteSlug,
	iframe,
	dispatch,
	getState,
	signal,
	mainTabStatus,
	onReady,
}: {
	siteSlug: string;
	iframe: HTMLIFrameElement;
	dispatch: PlaygroundDispatch;
	getState: () => PlaygroundReduxState;
	signal: AbortSignal;
	mainTabStatus: 'connected' | 'booting' | 'missing';
	onReady?: () => void;
}): void {
	const remoteUrl = getRemoteUrl();
	const scopedSiteUrl = `/scope:${encodeURIComponent(siteSlug)}/`;
	const scopedUrl = new URL(scopedSiteUrl, remoteUrl);
	const landingPage = getBrowserPathAsLandingPage() || '/';

	const dependentModeClient = {
		goTo: async (path: string) => {
			const newUrl = new URL(
				scopedSiteUrl + path.replace(/^\//, ''),
				remoteUrl
			);
			iframe.src = newUrl.toString();
		},
		getCurrentURL: async () => {
			return getDependentModeCurrentUrl(iframe, scopedSiteUrl) || '/';
		},
	} as PlaygroundClient;

	const updateUrlFromIframe = () => {
		const url = getDependentModeCurrentUrl(iframe, scopedSiteUrl);
		if (!url) {
			return;
		}
		dispatch(
			updateClientInfo({
				siteSlug,
				changes: { url },
			})
		);
	};
	const markIframeReady = () => {
		onReady?.();
	};

	const existingClient = selectClientInfoBySiteSlug(getState(), siteSlug);
	if (existingClient) {
		dispatch(
			updateClientInfo({
				siteSlug,
				changes: {
					url: landingPage,
					client: dependentModeClient,
					opfsMountDescriptor: undefined,
					isDependentMode: true,
					mainTabStatus,
				},
			})
		);
	} else {
		dispatch(
			addClientInfo({
				siteSlug,
				url: landingPage,
				client: dependentModeClient,
				opfsMountDescriptor: undefined,
				isDependentMode: true,
				mainTabStatus,
			})
		);
	}

	dispatch(
		updateSiteMetadata({
			slug: siteSlug,
			metadata: {
				lastAccessDate: Date.now(),
			},
		})
	);

	iframe.addEventListener('load', updateUrlFromIframe);
	iframe.addEventListener('load', markIframeReady, { once: true });
	signal.addEventListener(
		'abort',
		() => {
			iframe.removeEventListener('load', updateUrlFromIframe);
			iframe.removeEventListener('load', markIframeReady);
		},
		{ once: true }
	);

	// Resolve relative to scopedUrl so query strings stay in URL.search.
	iframe.src = new URL(landingPage.replace(/^\//, ''), scopedUrl).toString();
}

function getDependentModeCurrentUrl(
	iframe: HTMLIFrameElement,
	scopedSiteUrl: string
): string | undefined {
	try {
		const iframeHref = iframe.contentWindow?.location?.href;
		if (!iframeHref) {
			return;
		}
		const iframeUrl = new URL(iframeHref);
		if (!iframeUrl.pathname.startsWith(scopedSiteUrl)) {
			return;
		}
		const path = '/' + iframeUrl.pathname.slice(scopedSiteUrl.length);
		return path + iframeUrl.search;
	} catch {
		return;
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
