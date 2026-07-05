import { useEffect, useMemo, useRef, useState } from 'react';
import { useCurrentUrl } from '../../lib/state/url/router-hooks';
import { isSiteSavingDisabled } from '../../lib/state/url/router';
import { opfsSiteStorage } from '../../lib/state/opfs/opfs-site-storage';
import {
	OPFSSitesLoaded,
	isAutosavedSite,
	selectSiteBySlug,
	selectSortedSites,
	wasSiteRecentlyInteractedWith,
} from '../../lib/state/redux/slice-sites';
import {
	selectActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../lib/state/redux/store';
import { logger } from '@php-wasm/logger';
import { usePrevious } from '../../lib/hooks/use-previous';
import {
	modalSlugs,
	setActiveModal,
	setAutosaveNudge,
	dismissAutosaveNudge,
} from '../../lib/state/redux/slice-ui';
import { selectClientBySiteSlug } from '../../lib/state/redux/slice-clients';
import { useSitesAPI } from '../../lib/state/redux/site-management-api-middleware';
import {
	getAutosaveFingerprintFromSite,
	getAutosaveFingerprintFromURL,
} from '../../lib/state/playground-identity';

/**
 * Ensures the redux store always has an activeSite value.
 *
 * It has two routing modes:
 * * When `site-slug` is provided, it loads that site or creates it if missing.
 * * When `site-slug` is missing, it starts from the current setup URL and
 *   creates an autosaved site unless the shell requires a temporary one.
 */
export function EnsurePlaygroundSiteIsSelected({
	children,
}: {
	children: React.ReactNode;
}) {
	const siteListingStatus = useAppSelector(
		(state) => state.sites.opfsSitesLoadingState
	);
	const activeSite = useAppSelector((state) => selectActiveSite(state));
	const sortedSites = useAppSelector(selectSortedSites);
	const dispatch = useAppDispatch();
	const sitesAPI = useSitesAPI();
	const url = useCurrentUrl();
	const initialUrlHref = useRef(window.location.href);
	const defaultDocumentTitle = useRef(document.title);
	const requestedSiteSlug = url.searchParams.get('site-slug');
	const requestedSiteObject = useAppSelector((state) =>
		selectSiteBySlug(state, requestedSiteSlug!)
	);
	const isSavingDisabled = isSiteSavingDisabled(url);
	const shouldUseTemporarySite =
		url.searchParams.get('storage') === 'temp' ||
		isSavingDisabled ||
		!opfsSiteStorage;
	const requestedClientInfo = useAppSelector(
		(state) =>
			requestedSiteSlug &&
			selectClientBySiteSlug(state, requestedSiteSlug)
	);
	const [needMissingSitePromptForSlug, setNeedMissingSitePromptForSlug] =
		useState<false | string>(false);
	const declinedAutosaveRestoreFingerprints = useAppSelector(
		(state) => state.ui.declinedAutosaveRestoreFingerprints
	);
	const autosaveNudgeMuted = useAppSelector(
		(state) => state.ui.autosaveNudgeMuted
	);
	const selectionRequestIdRef = useRef(0);
	const [selectionRetryCount, setSelectionRetryCount] = useState(0);
	const currentSetupUrlFingerprint = useMemo(
		() => getAutosaveFingerprintFromURL(url),
		[url.href]
	);

	const prevUrl = usePrevious(url);

	useEffect(() => {
		if (!opfsSiteStorage) {
			logger.error('Error loading sites: OPFS not available');
			dispatch(OPFSSitesLoaded([]));
			return;
		}
		opfsSiteStorage.list().then(
			(sites) => dispatch(OPFSSitesLoaded(sites)),
			(error) => {
				// @TODO: Display an error modal explaining what happened.
				logger.error('Error loading sites:', error);
				dispatch(OPFSSitesLoaded([]));
			}
		);
	}, [dispatch]);

	useEffect(() => {
		const selectionRequestId = ++selectionRequestIdRef.current;
		let retryRequested = false;
		const retryLatestRouteIfStale = () => {
			if (selectionRequestIdRef.current === selectionRequestId) {
				return false;
			}
			if (!retryRequested) {
				retryRequested = true;
				setSelectionRetryCount((count) => count + 1);
			}
			return true;
		};

		async function ensureSiteIsSelected() {
			const isInitialPageLoadUrl = url.href === initialUrlHref.current;
			const onlyUiChromeParamsChanged = didOnlyUiChromeParamsChange(
				prevUrl,
				url
			);
			// UI-only URL churn (opening/closing a pane or modal) must not
			// dismiss the autosave dot; only a real setup/site navigation means
			// the prompt no longer belongs to the current route.
			if (!isInitialPageLoadUrl && !onlyUiChromeParamsChanged) {
				dispatch(dismissAutosaveNudge());
			}

			// Don't create a new temporary site until the site listing settles.
			// Otherwise, the status change from "loading" to "loaded" would
			// re-run this entire effect, potentially leading to multiple
			// sites being created since we couldn't look for duplicates yet.
			if (!['loaded', 'error'].includes(siteListingStatus)) {
				return;
			}

			// If the site slug is provided, try to load the site.
			if (requestedSiteSlug) {
				// If the site does not exist, create it. Saved browser
				// storage is the default unless this shell should not offer
				// saving.
				if (!requestedSiteObject) {
					logger.log(
						'The requested site was not found. Creating a new site.'
					);

					if (shouldUseTemporarySite) {
						await sitesAPI.createNewTemporarySite(
							requestedSiteSlug
						);
						if (retryLatestRouteIfStale()) {
							return;
						}
						if (!isSavingDisabled) {
							setNeedMissingSitePromptForSlug(requestedSiteSlug);
						}
					} else {
						try {
							await sitesAPI.createNewSavedSite(
								requestedSiteSlug
							);
							if (retryLatestRouteIfStale()) {
								return;
							}
						} catch (error) {
							if (retryLatestRouteIfStale()) {
								return;
							}
							logger.error(
								'Error creating saved site. Falling back to a temporary site.',
								error
							);
							await sitesAPI.createNewTemporarySite(
								requestedSiteSlug
							);
							if (retryLatestRouteIfStale()) {
								return;
							}
							setNeedMissingSitePromptForSlug(requestedSiteSlug);
						}
					}
					return;
				}

				await sitesAPI.setActiveSite(requestedSiteSlug);
				if (retryLatestRouteIfStale()) {
					return;
				}
				return;
			}

			// If only UI-chrome parameters change, don't reload the Playground.
			// `overlay` is removed when the dock pane closes; treating that as
			// a setup change would create a fresh site just because the user
			// dismissed the pane.
			const avoidUnnecessaryTempSiteReload =
				activeSite && onlyUiChromeParamsChanged;
			if (avoidUnnecessaryTempSiteReload) {
				return;
			}

			if (shouldUseTemporarySite) {
				await sitesAPI.createNewTemporarySite();
				if (retryLatestRouteIfStale()) {
					return;
				}
			} else {
				// Recreating an autosave resets the same slug before routing to
				// its new setup URL. Keep that pending site selected instead of
				// treating the route change as a request for another autosave.
				if (
					activeSite &&
					isAutosavedSite(activeSite) &&
					activeSite.metadata.initialOpfsSyncPending &&
					getAutosaveFingerprintFromSite(activeSite) ===
						currentSetupUrlFingerprint
				) {
					return;
				}

				// Offer restore only when the autosave came from the same
				// setup URL. A different setup URL should create a fresh
				// Playground even if another autosave exists.
				const matchingAutosave = sortedSites
					.filter(isAutosavedSite)
					.find(
						(site) =>
							getAutosaveFingerprintFromSite(site) ===
							currentSetupUrlFingerprint
					);
				const activeSiteMatchesCurrentSetup =
					activeSite &&
					getAutosaveFingerprintFromSite(activeSite) ===
						currentSetupUrlFingerprint;
				if (
					matchingAutosave &&
					activeSiteMatchesCurrentSetup &&
					(autosaveNudgeMuted ||
						declinedAutosaveRestoreFingerprints.includes(
							currentSetupUrlFingerprint
						))
				) {
					// Dismissing or muting the restore prompt autosaves the fresh
					// Playground asynchronously. That state change re-runs this
					// effect; do not start a second autosave when the current
					// Playground already represents this setup URL.
					return;
				}
				if (
					matchingAutosave &&
					isInitialPageLoadUrl &&
					!autosaveNudgeMuted &&
					!declinedAutosaveRestoreFingerprints.includes(
						currentSetupUrlFingerprint
					) &&
					wasSiteRecentlyInteractedWith(matchingAutosave)
				) {
					dispatch(
						setAutosaveNudge({
							siteSlug: matchingAutosave.slug,
							setupUrlFingerprint: currentSetupUrlFingerprint,
							whenCreated: matchingAutosave.metadata.whenCreated,
						})
					);
					await sitesAPI.createNewTemporarySite();
					if (retryLatestRouteIfStale()) {
						return;
					}
					return;
				}

				try {
					await sitesAPI.createNewSavedSite(undefined, undefined, {
						persistence: 'autosave',
						updateUrl: false,
					});
					if (retryLatestRouteIfStale()) {
						return;
					}
				} catch (error) {
					if (retryLatestRouteIfStale()) {
						return;
					}
					logger.error(
						'Error creating saved site. Falling back to a temporary site.',
						error
					);
					await sitesAPI.createNewTemporarySite();
					if (retryLatestRouteIfStale()) {
						return;
					}
				}
			}
		}

		void ensureSiteIsSelected().catch((error) => {
			if (retryLatestRouteIfStale()) {
				return;
			}
			logger.error('Error selecting Playground site.', error);
		});
		// Site and client state are outputs of this effect, not triggers.
		// Re-running while `createNewSavedSite()` is between the OPFS metadata
		// write and the iframe boot can mistake that half-created autosave for
		// a restore candidate and create a second temporary site.
		// `selectionRetryCount` is only incremented by stale async work after a
		// newer URL already started resolving. It makes the latest route win if
		// an older boot finishes last and changes the active Playground.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		declinedAutosaveRestoreFingerprints,
		autosaveNudgeMuted,
		url.href,
		requestedSiteSlug,
		siteListingStatus,
		selectionRetryCount,
	]);

	useEffect(() => {
		if (
			needMissingSitePromptForSlug &&
			needMissingSitePromptForSlug === requestedSiteSlug &&
			requestedClientInfo
		) {
			dispatch(setActiveModal(modalSlugs.MISSING_SITE_PROMPT));
			setNeedMissingSitePromptForSlug(false);
		}
	}, [
		needMissingSitePromptForSlug,
		requestedSiteSlug,
		requestedClientInfo,
		dispatch,
	]);

	useEffect(() => {
		const pageTitle = url.searchParams.get('page-title');
		document.title = pageTitle || defaultDocumentTitle.current;
	}, [url.searchParams]);

	return children;
}

function didOnlyUiChromeParamsChange(
	previousUrl: URL | undefined,
	nextUrl: URL
): boolean {
	if (!previousUrl) {
		return false;
	}
	const oldParams = new URLSearchParams(previousUrl.search);
	const newParams = new URLSearchParams(nextUrl.search);
	for (const param of ['modal', 'overlay', 'page-title']) {
		oldParams.delete(param);
		newParams.delete(param);
	}
	return (
		previousUrl.origin === nextUrl.origin &&
		previousUrl.pathname === nextUrl.pathname &&
		oldParams.toString() === newParams.toString() &&
		previousUrl.hash === nextUrl.hash
	);
}
