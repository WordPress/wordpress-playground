import { useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import { Button, Icon, Popover } from '@wordpress/components';
import { close, wordpress } from '@wordpress/icons';
import css from './restore-autosave-nudge.module.css';
import calloutCss from '../dock-callout.module.css';
import { useCurrentUrl } from '../../lib/state/url/router-hooks';
import { isSiteSavingDisabled } from '../../lib/state/url/router';
import { opfsSiteStorage } from '../../lib/state/opfs/opfs-site-storage';
import {
	OPFSSitesLoaded,
	getSiteRecencyTimestamp,
	isAutosavedSite,
	isRestorableAutosavedSite,
	selectSortedSites,
	type SiteInfo,
	wasSiteRecentlyInteractedWith,
} from '../../lib/state/redux/slice-sites';
import {
	isYouHaveAutosaveNudgeEnabled,
	selectActiveSite,
	setYouHaveAutosaveNudgeEnabled,
	useAppDispatch,
	useAppSelector,
} from '../../lib/state/redux/store';
import { logger } from '@php-wasm/logger';
import { usePrevious } from '../../lib/hooks/use-previous';
import {
	setDockPaneOpen,
	setDockPaneSection,
	setDockOperationNotice,
} from '../../lib/state/redux/slice-ui';
import { selectClientBySiteSlug } from '../../lib/state/redux/slice-clients';
import { useSitesAPI } from '../../lib/state/redux/site-management-api-middleware';
import {
	getAutosaveFingerprintFromSite,
	getAutosaveFingerprintFromURL,
} from '../../lib/state/playground-identity';
import { getRelativeDate } from '../../lib/get-relative-date';
import { listenForPointerDownAcrossIframes } from './listen-for-pointer-down-across-iframes';
import {
	RecentAutosaveNudgeProvider,
	useRecentAutosaveNudgeAnchor,
} from './recent-autosave-nudge-context';

/**
 * Starts fresh setup URLs, but leaves saved-site startup to the website UI.
 *
 * A plugin can open /?site-slug=demo in another window. That URL must not boot
 * demo's PHP runtime or mount its saved files. Open Your Playgrounds instead;
 * selecting a site there activates it before updating the URL. Unknown slugs
 * take the same path, so guessing names cannot create sites or test their presence.
 * A URL may still select a client already running in this page, without booting it.
 *
 * Without site-slug, keep the existing fresh-site and autosave-restore behavior.
 * This component belongs to the website entrypoint only: remote.html and direct
 * client-library embeds keep their startup API. This is not HTTP authorization
 * between running sites or a restriction on explicit saved-file API calls.
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
	const activeClientInfo = useAppSelector((state) =>
		activeSite ? selectClientBySiteSlug(state, activeSite.slug) : undefined
	);
	const [autosaveNudge, setAutosaveNudge] = useState<{
		site: SiteInfo;
		setupUrlFingerprint: string;
	}>();
	const [
		declinedYouHaveAutosaveFingerprints,
		setDeclinedYouHaveAutosaveFingerprints,
	] = useState<string[]>([]);
	const [autosaveNudgeError, setAutosaveNudgeError] = useState<string>();
	const [youHaveAutosaveNudgeEnabled, setYouHaveAutosaveNudgeEnabledState] =
		useState(isYouHaveAutosaveNudgeEnabled);
	const [isAutosaveNudgeActionPending, setIsAutosaveNudgeActionPending] =
		useState(false);
	const autosaveNudgeActionPendingRef = useRef(false);
	const currentSetupUrlFingerprint = useMemo(
		() => getAutosaveFingerprintFromURL(url),
		[url.href]
	);
	// An open Dock pane owns the screen (all of it on mobile), so the nudge
	// waits for it to close instead of covering it. This also keeps Escape
	// working for the pane: the Dock lets any open popover consume Escape
	// first, but the nudge popover never does.
	const dockPaneIsOpen = useAppSelector((state) => state.ui.dockPaneIsOpen);
	const canShowAutosaveNudge =
		youHaveAutosaveNudgeEnabled &&
		!dockPaneIsOpen &&
		autosaveNudge &&
		activeSite &&
		activeSite.slug !== autosaveNudge.site.slug &&
		!!activeClientInfo &&
		getAutosaveFingerprintFromSite(activeSite) ===
			autosaveNudge.setupUrlFingerprint;

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
				logger.error('Error loading sites:', error);
				dispatch(
					setDockOperationNotice({
						status: 'error',
						title: 'Couldn’t load Playgrounds',
						message:
							'Reload the page to try browser storage again.',
					})
				);
				dispatch(OPFSSitesLoaded([]));
			}
		);
	}, [dispatch]);

	useEffect(() => {
		/** Follow setup URLs, but select saved sites only when their client is already running. */
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

			if (requestedSiteSlug) {
				if (activeSite?.slug === requestedSiteSlug) return;
				if (requestedClientInfo) {
					// Retained temporary/syncing frames are already running. Selecting
					// one is safe here; a URL must never create a new saved-site client.
					await sitesAPI.setActiveSite(requestedSiteSlug);
				} else {
					dispatch(setDockPaneSection('playgrounds'));
					dispatch(setDockPaneOpen(true));
				}
				return;
			}

			// Dock navigation removes `overlay` from the URL. Like `modal`, it
			// must not create another Playground or discard the clone form.
			// Keep ignoring the hash here: the Blueprint editor writes its draft
			// there, but only Run Blueprint should replace the running site.
			const oldParams = new URLSearchParams(prevUrl?.search);
			const newParams = new URLSearchParams(url.search);
			for (const parameter of ['modal', 'overlay']) {
				oldParams.delete(parameter);
				newParams.delete(parameter);
			}
			const avoidUnnecessaryTempSiteReload =
				activeSite && oldParams.toString() === newParams.toString();
			if (avoidUnnecessaryTempSiteReload) {
				return;
			}

			if (shouldUseTemporarySite) {
				await sitesAPI.createNewTemporarySite();
			} else {
				// `initialOpfsSyncPending` describes two different situations:
				//
				// 1. A site created in this tab is still copying WordPress files
				//    into OPFS. If this effect runs again before the copy finishes,
				//    keep that site active instead of creating a duplicate.
				// 2. A site loaded from OPFS still has the flag because an earlier
				//    tab closed or reloaded during the copy. That site is incomplete
				//    and cannot boot. For example, "Start a new Playground" must be
				//    allowed to create a different site instead of keeping it active.
				//
				// `loadedFromStorage` distinguishes the interrupted second case.
				if (
					activeSite &&
					activeSite.loadedFromStorage !== true &&
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
					.filter(isRestorableAutosavedSite)
					.find(
						(site) =>
							getAutosaveFingerprintFromSite(site) ===
							currentSetupUrlFingerprint
					);
				if (
					matchingAutosave &&
					isInitialPageLoadUrl &&
					youHaveAutosaveNudgeEnabled &&
					!declinedYouHaveAutosaveFingerprints.includes(
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
		youHaveAutosaveNudgeEnabled,
		declinedYouHaveAutosaveFingerprints,
		url.href,
		requestedSiteSlug,
		siteListingStatus,
	]);

	useEffect(() => {
		const pageTitle = url.searchParams.get('page-title');
		if (pageTitle) {
			document.title = pageTitle;
		}
	}, [url.searchParams]);

	const keepNewPlayground = async (): Promise<boolean> => {
		if (!autosaveNudge || autosaveNudgeActionPendingRef.current) {
			return false;
		}
		const dismissedNudge = autosaveNudge;
		autosaveNudgeActionPendingRef.current = true;
		setAutosaveNudge(undefined);
		setAutosaveNudgeError(undefined);
		setIsAutosaveNudgeActionPending(true);
		// Dismissing the restore choice settles it for this page load. If keeping
		// the new Playground fails, report that save failure separately instead of
		// reopening a prompt about the older autosave.
		setDeclinedYouHaveAutosaveFingerprints((fingerprints) =>
			fingerprints.includes(dismissedNudge.setupUrlFingerprint)
				? fingerprints
				: [...fingerprints, dismissedNudge.setupUrlFingerprint]
		);
		try {
			await sitesAPI.autosaveTemporarySite(undefined, {
				updateUrl: false,
				excludeFromPruning: [dismissedNudge.site.slug],
			});
			return true;
		} catch (error) {
			logger.error(
				'Error autosaving the new Playground after declining restore.',
				error
			);
			dispatch(
				setDockOperationNotice({
					status: 'error',
					title: 'Couldn’t autosave this Playground',
					message:
						'It’s still open but will be lost on refresh. Your earlier autosave is unchanged.',
				})
			);
			return false;
		} finally {
			autosaveNudgeActionPendingRef.current = false;
			setIsAutosaveNudgeActionPending(false);
		}
	};

	return (
		<RecentAutosaveNudgeProvider visible={!!canShowAutosaveNudge}>
			{children}
			{canShowAutosaveNudge && (
				<YouHaveAutosaveNudge
					site={autosaveNudge.site}
					error={autosaveNudgeError}
					isBusy={isAutosaveNudgeActionPending}
					onRestore={async () => {
						if (autosaveNudgeActionPendingRef.current) {
							return;
						}
						autosaveNudgeActionPendingRef.current = true;
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
							autosaveNudgeActionPendingRef.current = false;
							setIsAutosaveNudgeActionPending(false);
						}
					}}
					onDismiss={async () => {
						await keepNewPlayground();
					}}
					onDisableNotifications={async () => {
						if (await keepNewPlayground()) {
							setYouHaveAutosaveNudgeEnabled(false);
							setYouHaveAutosaveNudgeEnabledState(false);
						}
					}}
				/>
			)}
		</RecentAutosaveNudgeProvider>
	);
}

/**
 * Shows the restore choice for a recent autosave matching the current setup URL.
 *
 * The choice concerns saved Playgrounds, so the card is anchored right above
 * the Playgrounds Dock button with a caret pointing at it. A collapsed Dock
 * hides that button and the caret points at the save status instead; a
 * cornered Dock shows neither and the card floats in the top-right corner.
 */
function YouHaveAutosaveNudge({
	site,
	error,
	isBusy,
	onRestore,
	onDismiss,
	onDisableNotifications,
}: {
	site: SiteInfo;
	error?: string;
	isBusy: boolean;
	onRestore: () => Promise<void>;
	onDismiss: () => Promise<void>;
	onDisableNotifications: () => Promise<void>;
}) {
	const nudgeRef = useRef<HTMLElement>(null);
	const anchorButton = useRecentAutosaveNudgeAnchor();
	const autosavedAt = new Date(getSiteRecencyTimestamp(site) || Date.now());

	useEffect(() => {
		const dismissOnOutsidePointer = (event: PointerEvent) => {
			if (isBusy || nudgeRef.current?.contains(event.target as Node)) {
				return;
			}
			void onDismiss();
		};
		return listenForPointerDownAcrossIframes(dismissOnOutsidePointer);
	}, [isBusy, onDismiss]);

	const card = (
		<aside
			ref={nudgeRef}
			className={classNames(calloutCss.card, css.nudge, {
				[css.nudgeFloating]: !anchorButton,
				[calloutCss.surface]: !anchorButton,
			})}
			aria-label="Recent autosaved Playground"
		>
			<div className={calloutCss.header}>
				<div className={calloutCss.eyebrow}>Recent autosave</div>
				<Button
					className={calloutCss.dismiss}
					icon={close}
					label="Dismiss and keep this Playground"
					onClick={onDismiss}
					disabled={isBusy}
				/>
			</div>
			<div className={calloutCss.identity}>
				<span className={calloutCss.avatar} aria-hidden="true">
					<Icon icon={wordpress} size={28} />
				</span>
				<div className={calloutCss.identityCopy}>
					<div className={calloutCss.identityTitle}>
						{site.metadata.name}
					</div>
					<div className={calloutCss.identityMeta}>
						Autosaved {getRelativeDate(autosavedAt)}
					</div>
				</div>
			</div>
			{error && (
				<div className={css.error} role="alert">
					{error}
				</div>
			)}
			<Button
				variant="primary"
				className={calloutCss.primaryAction}
				onClick={onRestore}
				disabled={isBusy}
			>
				Restore autosave
			</Button>
			<p className={calloutCss.hint}>
				Kept in this browser as a periodic snapshot — not every change
				is saved.
			</p>
			<Button
				variant="link"
				className={css.disableNotifications}
				onClick={onDisableNotifications}
				disabled={isBusy}
			>
				Don’t notify me about autosaves
			</Button>
		</aside>
	);

	return (
		<>
			<div className={css.scrim} aria-hidden="true" />
			{anchorButton ? (
				<Popover
					className={classNames(calloutCss.popover, css.nudgePopover)}
					anchor={anchorButton}
					placement="top"
					offset={18}
					shift
					noArrow={false}
					focusOnMount={false}
				>
					{card}
				</Popover>
			) : (
				card
			)}
		</>
	);
}
