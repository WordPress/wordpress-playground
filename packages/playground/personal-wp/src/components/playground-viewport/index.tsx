import { useEffect, useRef } from 'react';

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
import { selectSiteBySlug } from '../../lib/state/redux/slice-sites';
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
	const activeSite = useActiveSite();

	if (displayMode === 'seamless') {
		return activeSite ? <JustViewport siteSlug={activeSite.slug} /> : null;
	}
	return <BrowserChrome className={className} />;
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
