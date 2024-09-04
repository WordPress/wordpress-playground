import React, { useEffect, useRef } from 'react';

import css from './style.module.css';
import BrowserChrome from '../browser-chrome';
import { usePlaygroundContext } from '../../playground-context';
import { useSelector } from 'react-redux';
import {
	bootPlayground,
	getClientState,
	PlaygroundReduxState,
	useAppDispatch,
} from '../../lib/webapp-state/redux-store';
import { setupPostMessageRelay } from '@php-wasm/web';

export const supportedDisplayModes = [
	'browser-full-screen',
	'seamless',
] as const;
export type DisplayMode = (typeof supportedDisplayModes)[number];
interface PlaygroundViewportProps {
	displayMode?: DisplayMode;
	toolbarButtons?: Array<React.ReactElement | false | null>;
	children?: React.ReactNode;
	siteSlug?: string;
	hideToolbar?: boolean;
	className?: string;
}

export const PlaygroundViewport = ({
	displayMode = 'browser-full-screen',
	toolbarButtons,
	hideToolbar,
	className,
}: PlaygroundViewportProps) => {
	const { playground, currentUrl: url } = usePlaygroundContext();

	if (displayMode === 'seamless') {
		// No need to boot the playground if seamless.
		return <JustViewport />;
	}
	return (
		<BrowserChrome
			showAddressBar={!!playground}
			url={url}
			toolbarButtons={toolbarButtons}
			onUrlChange={(url) => playground?.goTo(url)}
			hideToolbar={hideToolbar}
			className={className}
		>
			<JustViewport />
		</BrowserChrome>
	);
};

export const JustViewport = function LoadedViewportComponent() {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const iframe = (iframeRef as any)?.current;
	useEffect(() => {
		if (iframe) {
			setupPostMessageRelay(iframe, document.location.origin);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [!!iframe]);

	const siteSlug = useSelector(
		(state: PlaygroundReduxState) => state.app.activeSiteSlug
	);
	const clientState = useSelector((state: PlaygroundReduxState) =>
		getClientState(state, siteSlug)
	);

	const dispatch = useAppDispatch();
	useEffect(() => {
		if (clientState === 'missing' && iframe) {
			dispatch(
				bootPlayground({
					blueprint: {},
					iframe,
					siteId: siteSlug,
				})
			);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [clientState, !!iframe]);

	return (
		<div className={css.fullSize}>
			<iframe
				id="playground-viewport"
				key={siteSlug}
				title="WordPress Playground wrapper (the actual WordPress site is in another, nested iframe)"
				className={css.fullSize}
				ref={iframeRef}
			></iframe>
		</div>
	);
};
