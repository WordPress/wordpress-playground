import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@wordpress/components';
import css from './restore-autosave-nudge.module.css';
import { useCurrentUrl } from '../../lib/state/url/router-hooks';
import { isSiteSavingDisabled } from '../../lib/state/url/router';
import { opfsSiteStorage } from '../../lib/state/opfs/opfs-site-storage';
import {
	OPFSSitesLoaded,
	isAutosavedSite,
	selectSiteBySlug,
	selectSortedSites,
	type SiteInfo,
	wasSiteRecentlyInteractedWith,
} from '../../lib/state/redux/slice-sites';
import {
	selectActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../lib/state/redux/store';
import { logger } from '@php-wasm/logger';
import { usePrevious } from '../../lib/hooks/use-previous';
import { modalSlugs, setActiveModal } from '../../lib/state/redux/slice-ui';
import { selectClientBySiteSlug } from '../../lib/state/redux/slice-clients';
import { useSitesAPI } from '../../lib/state/redux/site-management-api-middleware';
import {
	getAutosaveFingerprintFromSite,
	getAutosaveFingerprintFromURL,
} from '../../lib/state/playground-identity';
import { getRelativeDate } from '../../lib/get-relative-date';

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
	const [autosaveNudge, setAutosaveNudge] = useState<{
		site: SiteInfo;
		setupUrlFingerprint: string;
	}>();
	const [
		declinedAutosaveRestoreFingerprints,
		setDeclinedAutosaveRestoreFingerprints,
	] = useState<string[]>([]);
	const [autosaveNudgeError, setAutosaveNudgeError] = useState<string>();
	const [isAutosaveNudgeActionPending, setIsAutosaveNudgeActionPending] =
		useState(false);
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
		async function ensureSiteIsSelected() {
			const isInitialPageLoadUrl = url.href === initialUrlHref.current;
			if (!isInitialPageLoadUrl) {
				setAutosaveNudge(undefined);
				setAutosaveNudgeError(undefined);
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
						if (!isSavingDisabled) {
							setNeedMissingSitePromptForSlug(requestedSiteSlug);
						}
					} else {
						try {
							await sitesAPI.createNewSavedSite(
								requestedSiteSlug
							);
						} catch (error) {
							logger.error(
								'Error creating saved site. Falling back to a temporary site.',
								error
							);
							await sitesAPI.createNewTemporarySite(
								requestedSiteSlug
							);
							setNeedMissingSitePromptForSlug(requestedSiteSlug);
						}
					}
					return;
				}

				await sitesAPI.setActiveSite(requestedSiteSlug);
				return;
			}

			// If only the 'modal' parameter changes in searchParams, don't reload the page
			const notRefreshingParam = 'modal';
			const oldParams = new URLSearchParams(prevUrl?.search);
			const newParams = new URLSearchParams(url?.search);
			oldParams.delete(notRefreshingParam);
			newParams.delete(notRefreshingParam);
			const avoidUnnecessaryTempSiteReload =
				activeSite && oldParams.toString() === newParams.toString();
			if (avoidUnnecessaryTempSiteReload) {
				return;
			}

			if (shouldUseTemporarySite) {
				await sitesAPI.createNewTemporarySite();
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
				if (
					matchingAutosave &&
					isInitialPageLoadUrl &&
					!declinedAutosaveRestoreFingerprints.includes(
						currentSetupUrlFingerprint
					) &&
					wasSiteRecentlyInteractedWith(matchingAutosave)
				) {
					setAutosaveNudge({
						site: matchingAutosave,
						setupUrlFingerprint: currentSetupUrlFingerprint,
					});
					await sitesAPI.createNewTemporarySite();
					return;
				}

				try {
					await sitesAPI.createNewSavedSite(undefined, undefined, {
						persistence: 'autosave',
						updateUrl: false,
					});
				} catch (error) {
					logger.error(
						'Error creating saved site. Falling back to a temporary site.',
						error
					);
					await sitesAPI.createNewTemporarySite();
				}
			}
		}

		ensureSiteIsSelected();
		// Site and client state are outputs of this effect, not triggers.
		// Re-running while `createNewSavedSite()` is between the OPFS metadata
		// write and the iframe boot can mistake that half-created autosave for
		// a restore candidate and create a second temporary site.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		declinedAutosaveRestoreFingerprints,
		url.href,
		requestedSiteSlug,
		siteListingStatus,
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
		if (pageTitle) {
			document.title = pageTitle;
		}
	}, [url.searchParams]);

	return (
		<>
			{children}
			{autosaveNudge && (
				<RestoreAutosaveNudge
					site={autosaveNudge.site}
					error={autosaveNudgeError}
					isBusy={isAutosaveNudgeActionPending}
					onRestore={async () => {
						setAutosaveNudgeError(undefined);
						setIsAutosaveNudgeActionPending(true);
						try {
							await sitesAPI.setActiveSite(
								autosaveNudge.site.slug
							);
							setAutosaveNudge(undefined);
						} catch (error) {
							logger.error(
								'Error restoring autosaved Playground.',
								error
							);
							setAutosaveNudgeError(
								'Could not restore the autosave. Try again or keep the new Playground.'
							);
						} finally {
							setIsAutosaveNudgeActionPending(false);
						}
					}}
					onKeepNew={async () => {
						setAutosaveNudgeError(undefined);
						setIsAutosaveNudgeActionPending(true);
						try {
							await sitesAPI.autosaveTemporarySite(undefined, {
								updateUrl: false,
								excludeFromPruning: [autosaveNudge.site.slug],
							});
							setDeclinedAutosaveRestoreFingerprints(
								(fingerprints) => [
									...fingerprints,
									autosaveNudge.setupUrlFingerprint,
								]
							);
							setAutosaveNudge(undefined);
						} catch (error) {
							logger.error(
								'Error autosaving the new Playground after declining restore.',
								error
							);
							setAutosaveNudgeError(
								'Could not keep the new Playground. Please try again.'
							);
						} finally {
							setIsAutosaveNudgeActionPending(false);
						}
					}}
				/>
			)}
		</>
	);
}

/**
 * Shows the restore choice for a recent autosave matching the current setup URL.
 */
function RestoreAutosaveNudge({
	site,
	error,
	isBusy,
	onRestore,
	onKeepNew,
}: {
	site: SiteInfo;
	error?: string;
	isBusy: boolean;
	onRestore: () => Promise<void>;
	onKeepNew: () => Promise<void>;
}) {
	const createdAt = new Date(site.metadata.whenCreated ?? Date.now());

	return (
		<aside className={css.nudge} aria-label="Recent autosaved Playground">
			<div className={css.copy}>
				<div className={css.title}>Recent autosave available</div>
				<div className={css.description}>
					Another Playground was created {getRelativeDate(createdAt)}{' '}
					from the same URL.
				</div>
				{error && <div className={css.error}>{error}</div>}
			</div>
			<div className={css.actions}>
				<Button variant="primary" onClick={onRestore} disabled={isBusy}>
					Restore Autosave
				</Button>
				<Button
					variant="tertiary"
					onClick={onKeepNew}
					disabled={isBusy}
				>
					No, thanks
				</Button>
			</div>
		</aside>
	);
}
