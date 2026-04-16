import { useEffect, useRef } from 'react';

// Handle blueprint install requests from WordPress plugins.
// This must be a global listener (not inside a React useEffect)
// because the relay message arrives before the component mounts
// on subsequent navigations.
window.addEventListener('message', (e) => {
	if (
		typeof e.data === 'object' &&
		e.data?.type === 'relay' &&
		e.data?.relayType === 'install-blueprint' &&
		e.data?.blueprintUrl
	) {
		const url = new URL(window.location.origin);
		url.searchParams.set('blueprint-url', e.data.blueprintUrl);
		window.location.href = url.toString();
	}
});

import css from './style.module.css';
import BrowserChrome from '../browser-chrome';
import {
	selectActiveSiteError,
	selectActiveSiteErrorDetails,
	getActiveClientInfo,
	useActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../lib/state/redux/store';
import { removeClientInfo } from '../../lib/state/redux/slice-clients';
import { bootSiteClient } from '../../lib/state/redux/boot-site-client';
import { selectSiteBySlug } from '../../lib/state/redux/slice-sites';
import classNames from 'classnames';
import { SiteErrorModal } from '../site-error-modal';
import { setSiteManagerOpen } from '../../lib/state/redux/slice-ui';
import { playgroundLogo } from '@wp-playground/components';
import Button from '../button';

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
	const activeSite = useActiveSite();

	if (displayMode === 'seamless') {
		return activeSite ? (
			<SeamlessViewport siteSlug={activeSite.slug} />
		) : null;
	}
	return <BrowserChrome className={className} />;
};

function SeamlessViewport({ siteSlug }: { siteSlug: string }) {
	const dispatch = useAppDispatch();
	const siteManagerIsOpen = useAppSelector(
		(state) => state.ui.siteManagerIsOpen
	);
	const clientInfo = useAppSelector(getActiveClientInfo);
	const url = clientInfo?.url;

	// Reflect the WordPress URL in the browser's address bar.
	useEffect(() => {
		if (!url) {
			return;
		}
		const browserUrl =
			window.location.origin + (url.startsWith('/') ? url : '/' + url);
		if (browserUrl !== window.location.href) {
			window.history.pushState({}, '', browserUrl);
		}
	}, [url]);

	return (
		<div className={css.seamlessWrapper}>
			<JustViewport siteSlug={siteSlug} />

			<div
				className={classNames(css.sidebarLatch, {
					[css.sidebarLatchHidden]: siteManagerIsOpen,
				})}
			>
				<Button
					variant="browser-chrome"
					aria-label={
						siteManagerIsOpen
							? 'Close Site Tools'
							: 'Open Site Tools'
					}
					aria-pressed={siteManagerIsOpen}
					className={css.sidebarLatchButton}
					onClick={() => {
						dispatch(setSiteManagerOpen(!siteManagerIsOpen));
					}}
				>
					{playgroundLogo({ width: 24, height: 24 })}
				</Button>
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
				clearUrlAfterBlueprintApplied: true,
				autoLogin: true,
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
