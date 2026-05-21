import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@wordpress/components';
import css from './restore-autosave-nudge.module.css';
import { useCurrentUrl } from '../../lib/state/url/router-hooks';
import {
	isSaveDisabledByQueryParam,
	isTemporaryStorageRequested,
} from '../../lib/state/url/router';
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
	getSetupUrlFingerprint,
	getSetupUrlFingerprintFromSite,
} from '../../lib/state/url/setup-url';
import { getRelativeDate } from '../../lib/get-relative-date';

/**
 * Ensures the redux store always has an activeSite value.
 *
 * It has two routing modes:
 * * When `site-slug` is provided, it load an existing site
 * * When `site-slug` is missing, it creates a new site using the Query API and Blueprint API
 *   data sourced from the current URL.
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
	const shouldUseTemporarySite =
		isTemporaryStorageRequested(url.href) ||
		isSaveDisabledByQueryParam() ||
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
	const [freshSetupFingerprints, setFreshSetupFingerprints] = useState<
		string[]
	>([]);
	const currentSetupUrlFingerprint = useMemo(
		() => getSetupUrlFingerprint(url),
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
				// storage is the default unless the URL explicitly asks for
				// a temporary site or saving is unavailable.
				if (!requestedSiteObject) {
					logger.log(
						'The requested site was not found. Creating a new site.'
					);

					if (shouldUseTemporarySite) {
						await sitesAPI.createNewTemporarySite(
							requestedSiteSlug
						);
						if (!isSaveDisabledByQueryParam()) {
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
				const matchingAutosave = sortedSites
					.filter(isAutosavedSite)
					.find(
						(site) =>
							getSetupUrlFingerprintFromSite(site) ===
							currentSetupUrlFingerprint
					);
				if (
					matchingAutosave &&
					isInitialPageLoadUrl &&
					!freshSetupFingerprints.includes(
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		url.href,
		requestedSiteSlug,
		siteListingStatus,
		freshSetupFingerprints,
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
					onRestore={() => {
						void sitesAPI.setActiveSite(autosaveNudge.site.slug);
						setAutosaveNudge(undefined);
					}}
					onKeepNew={() => {
						setFreshSetupFingerprints((fingerprints) => [
							...fingerprints,
							autosaveNudge.setupUrlFingerprint,
						]);
						void sitesAPI.autosaveTemporarySite(undefined, {
							updateUrl: false,
							excludeFromPruning: [autosaveNudge.site.slug],
						});
						setAutosaveNudge(undefined);
					}}
				/>
			)}
		</>
	);
}

function RestoreAutosaveNudge({
	site,
	onRestore,
	onKeepNew,
}: {
	site: SiteInfo;
	onRestore: () => void;
	onKeepNew: () => void;
}) {
	const createdAt = new Date((site.metadata.whenCreated ?? Date.now()) - 2);

	return (
		<aside className={css.nudge} aria-label="Recent autosaved Playground">
			<div className={css.copy}>
				<div className={css.title}>Recent autosave available</div>
				<div className={css.description}>
					Another Playground was created {getRelativeDate(createdAt)}{' '}
					from the same setup URL.
				</div>
			</div>
			<div className={css.actions}>
				<Button variant="primary" onClick={onRestore}>
					Restore Autosave
				</Button>
				<Button variant="tertiary" onClick={onKeepNew}>
					No, thanks
				</Button>
			</div>
		</aside>
	);
}
