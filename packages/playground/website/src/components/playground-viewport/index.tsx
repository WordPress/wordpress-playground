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
import { removeClientInfo } from '../../lib/state/redux/slice-clients';
import { bootSiteClient } from '../../lib/state/redux/boot-site-client';
import { Spinner } from '@wordpress/components';
import {
	selectSiteBySlug,
	selectSitesLoaded,
	selectTemporarySites,
} from '../../lib/state/redux/slice-sites';
import classNames from 'classnames';
import { SiteErrorModal } from '../site-error-modal';

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
		return <KeepAliveTemporarySitesViewport />;
	}
	return (
		<BrowserChrome className={className}>
			<KeepAliveTemporarySitesViewport />
		</BrowserChrome>
	);
};

/**
 * A multi-viewport component that keeps all rendered temporary sites alive.
 * Technically, it retains their iframe node in the DOM. When the user switches
 * to another site, the iframe is hidden but not removed. This way, the state
 * of each temporary site is preserved as long as the browser tab remains open.
 *
 * Persistent sites are not affected by this. They are unmounted and rendered as usual
 * as there's no risk of data loss
 */
export const KeepAliveTemporarySitesViewport = () => {
	const temporarySites = useAppSelector(selectTemporarySites);
	const activeSite = useActiveSite();
	const siteSlugsToRender = useMemo(() => {
		let sites = temporarySites.filter(
			(site) => site.slug !== activeSite?.slug
		);
		if (activeSite) {
			sites = [...sites, activeSite];
		}
		return sites.map((site) => site.slug);
	}, [temporarySites, activeSite]);

	// Create a map of slug to site for easy lookup
	const sitesBySlug = useMemo(() => {
		const sites = [...temporarySites];
		if (activeSite) {
			sites.push(activeSite);
		}
		return new Map(sites.map((site) => [site.slug, site]));
	}, [temporarySites, activeSite]);
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

	const sitesFinishedLoading = useAppSelector(selectSitesLoaded);
	if (!sitesFinishedLoading) {
		return (
			<div
				className={css.fullSize}
				style={{
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
				}}
			>
				<Spinner style={{ width: '60px', height: '60px' }} />
			</div>
		);
	}

	return (
		<>
			{!activeSite && (
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
			{slugsSeenSoFar.map((slug) => {
				const site = sitesBySlug.get(slug);
				const viewportKey = site
					? `${slug}-${site.metadata.whenCreated}`
					: slug;
				return (
					<div
						key={slug}
						className={classNames(css.fullSize, {
							[css.hidden]: slug !== activeSite?.slug,
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

export const JustViewport = function JustViewport({
	siteSlug,
}: {
	siteSlug: string;
}) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const site = useAppSelector((state) => selectSiteBySlug(state, siteSlug))!;

	const dispatch = useAppDispatch();
	const runtimeConfigString = JSON.stringify(
		site.metadata.runtimeConfiguration
	);
	useEffect(() => {
		const iframe = iframeRef.current;
		if (!iframe) {
			return;
		}

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
	}, [siteSlug, iframeRef, runtimeConfigString]);

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
