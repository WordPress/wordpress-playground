import React, { useEffect, useMemo, useRef, useState } from 'react';

import css from './style.module.css';
import BrowserChrome from '../browser-chrome';
import {
	selectActiveSiteError,
	selectActiveSiteErrorDetails,
	useActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../lib/state/redux/store';
import {
	removeClientInfo,
	selectAllClientInfo,
} from '../../lib/state/redux/slice-clients';
import { bootSiteClient } from '../../lib/state/redux/boot-site-client';
import {
	selectAllSites,
	selectSiteBySlug,
	selectSitesLoaded,
	selectTemporarySites,
} from '../../lib/state/redux/slice-sites';
import classNames from 'classnames';
import { SiteErrorModal } from '../site-error-modal';
import { getRuntimeBootFingerprint } from '../../lib/state/playground-identity';

export const supportedDisplayModes = [
	'browser-full-screen',
	'seamless',
] as const;
export type DisplayMode = (typeof supportedDisplayModes)[number];
interface PlaygroundViewportProps {
	displayMode?: DisplayMode;
	children?: React.ReactNode;
	siteSlug?: string;
	className?: string;
}

export const PlaygroundViewport = ({
	displayMode = 'browser-full-screen',
	className,
}: PlaygroundViewportProps) => {
	if (displayMode === 'seamless') {
		return <KeepAliveTemporaryAndSyncingSitesViewport />;
	}
	return (
		<BrowserChrome className={className}>
			<KeepAliveTemporaryAndSyncingSitesViewport />
		</BrowserChrome>
	);
};

/**
 * A multi-viewport component that keeps temporary and syncing sites alive.
 * Technically, it retains their iframe node in the DOM. When the user switches
 * to another site, the iframe is hidden but not removed. This preserves
 * temporary state and lets an in-progress storage sync finish in the background.
 *
 * Persistent sites are otherwise unmounted and rendered as usual.
 */
export const KeepAliveTemporaryAndSyncingSitesViewport = () => {
	const temporarySites = useAppSelector(selectTemporarySites);
	const allSites = useAppSelector(selectAllSites);
	const allClientInfo = useAppSelector(selectAllClientInfo);
	const activeSite = useActiveSite();
	// Check if a site slug is set (even if the entity doesn't exist yet).
	// This handles the transitional state when navigating to create a new site.
	const activeSiteSlugIsSet = useAppSelector(
		(state) => !!state.ui.activeSite?.slug
	);
	const siteImportProgress = useAppSelector(
		(state) => state.ui.siteImportProgress
	);
	// Create a map of slug to site for easy lookup
	const sitesBySlug = useMemo(() => {
		return new Map(allSites.map((site) => [site.slug, site]));
	}, [allSites]);
	const siteSlugsToRender = useMemo(() => {
		const siteSlugs = new Set(temporarySites.map((site) => site.slug));
		for (const client of allClientInfo) {
			if (
				client.opfsSync?.status === 'syncing' &&
				sitesBySlug.has(client.siteSlug)
			) {
				siteSlugs.add(client.siteSlug);
			}
		}
		if (activeSite) {
			siteSlugs.delete(activeSite.slug);
			siteSlugs.add(activeSite.slug);
		}
		return Array.from(siteSlugs);
	}, [temporarySites, allClientInfo, activeSite, sitesBySlug]);
	/**
	 * ## Critical data loss prevention mechanism
	 *
	 * The `slugsSeenSoFar` array is necessary to keep the Playground sites running
	 * without being implicitly destroyed by React.
	 *
	 * ## The problem
	 *
	 * When an iframe is moved around in the DOM, its internal state is reset
	 * and the Playground site is lost. Unfortunately, React liberally moves
	 * DOM nodes around even when the `key` prop is set.
	 *
	 * Imagine we're rendering five site viewports, and a sixth site viewport is
	 * added at the beginning of the list in the next render.
	 *
	 * The only way to preserve the state the existing viewports, is to create a new
	 * DOM node for the sixth site viewport and insert it before the already existing
	 * viewports without moving any of the iframes or their parent nodes. Unfortunately,
	 * that's not what React does.
	 *
	 * I don't know exactly which DOM operations React performs, but the existing
	 * iframes are moved around and the Playground sites inside them are trashed
	 * in the process.
	 *
	 * ## The solution
	 *
	 * We never trash, reorder, or remove any DOM nodes.
	 *
	 * This append-only list of slugs is used to keep track of all the sites this
	 * component was ever asked to render. Every site stays in its own div, always
	 * at the same index in the DOM. Every new site is appended to the end of the list,
	 * never in the middle. When a site is deleted, we keep the top-level wrapper div
	 * and only remove the iframe inside it.
	 *
	 * This way, React never reassigns which div is which site and never moves our
	 * precious iframes around.
	 *
	 * The cost is that we render more and more divs over time. That's not a problem.
	 * We're talking about maybe a 100 empty divs in an extreme scenario. That's nothing.
	 */
	const [slugsSeenSoFar, setSlugsSeenSoFar] = useState<string[]>([]);
	useEffect(() => {
		setSlugsSeenSoFar((prev) => [
			...prev,
			...siteSlugsToRender.filter((slug) => !prev.includes(slug)),
		]);
	}, [siteSlugsToRender]);

	const hasVisibleSite = !!slugsSeenSoFar.find(
		(slug) => slug === activeSite?.slug
	);

	const sitesFinishedLoading = useAppSelector(selectSitesLoaded);
	if (!sitesFinishedLoading) {
		return <LoadingViewport caption="Loading Playgrounds" />;
	}

	return (
		<>
			{!activeSite && !activeSiteSlugIsSet && (
				// @TODO: Use the dedicated design for this
				// (the one in Figma with white background and pretty fonts.)
				<div className={css.fullSize}>
					<div className={css.siteError}>
						<div
							className={css.siteErrorContent}
							style={{ textAlign: 'center' }}
						>
							<h2>No site is selected</h2>
							<p>
								Select a site from the site manager to explore
								Playground.
							</p>
						</div>
					</div>
				</div>
			)}
			{(!hasVisibleSite || siteImportProgress) && (
				<LoadingViewport
					caption={
						siteImportProgress?.caption ?? 'Preparing WordPress'
					}
					progress={siteImportProgress?.progress}
				/>
			)}
			{slugsSeenSoFar.map((slug) => {
				const site = sitesBySlug.get(slug);
				const viewportKey = site
					? `${slug}-${site.metadata.whenCreated}`
					: slug;
				return (
					<div
						key={slug}
						className={classNames(css.fullSize, {
							[css.hidden]:
								slug !== activeSite?.slug ||
								!!siteImportProgress,
						})}
					>
						{siteSlugsToRender.includes(slug) ? (
							<JustViewport key={viewportKey} siteSlug={slug} />
						) : null}
					</div>
				);
			})}
		</>
	);
};

function LoadingViewport({
	caption,
	progress,
}: {
	caption: string;
	progress?: number;
}) {
	const progressPercent =
		progress !== undefined && progress > 0
			? Math.round(progress)
			: undefined;

	return (
		<div className={css.loadingViewport}>
			<h1 className={css.loadingCaption}>{caption}</h1>
			<div
				className={css.progressWrapper}
				aria-label={
					progress === undefined
						? 'WordPress loading progress'
						: 'WordPress import progress'
				}
				aria-valuemax={100}
				aria-valuemin={0}
				aria-valuenow={progressPercent}
				aria-valuetext={
					progressPercent === undefined
						? caption
						: `${caption}, ${progressPercent}%`
				}
				role="progressbar"
				style={
					{
						'--loading-progress': `${progress ?? 0}%`,
					} as React.CSSProperties
				}
			>
				<div className={css.progressBar} />
			</div>
		</div>
	);
}

export const JustViewport = function JustViewport({
	siteSlug,
}: {
	siteSlug: string;
}) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const site = useAppSelector((state) => selectSiteBySlug(state, siteSlug))!;

	const dispatch = useAppDispatch();
	const runtimeBootFingerprint = getRuntimeBootFingerprint(
		site.metadata.runtimeConfiguration
	);
	useEffect(() => {
		const iframe = iframeRef.current;
		if (!iframe) {
			return;
		}

		// This effect owns one iframe boot. Changing site slug or runtime
		// settings creates a new iframe while `startPlaygroundWeb()` or OPFS
		// sync work from the previous iframe may still finish later. The signal
		// lets `bootSiteClient()` ignore those stale callbacks; cleanup removes
		// this iframe's client info once.
		const abortController = new AbortController();
		dispatch(
			bootSiteClient(siteSlug, iframe, {
				signal: abortController.signal,
			})
		);

		return () => {
			abortController.abort();
			dispatch(removeClientInfo(siteSlug));
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [siteSlug, iframeRef, runtimeBootFingerprint]);

	const error = useAppSelector(selectActiveSiteError);
	const errorDetails = useAppSelector(selectActiveSiteErrorDetails);
	const activeSiteSlug = useAppSelector((state) => state.ui.activeSite?.slug);
	const showOverlay = error && activeSiteSlug === siteSlug;

	return (
		<>
			<iframe
				key={siteSlug}
				title="WordPress Playground wrapper (the actual WordPress site is in another, nested iframe)"
				className={classNames('playground-viewport', css.fullSize)}
				ref={iframeRef}
			/>
			{showOverlay ? (
				<SiteErrorModal
					error={error}
					siteSlug={siteSlug}
					site={site}
					errorDetails={errorDetails}
				/>
			) : null}
		</>
	);
};
