import React, { Ref, useEffect } from 'react';

import css from './style.module.css';
import BrowserChrome from '../browser-chrome';
import { StorageType } from '../../types';
import { setupPostMessageRelay } from '@php-wasm/web';
import { usePlaygroundContext } from '../../playground-context';

export const supportedDisplayModes = [
	'browser',
	'browser-full-screen',
	'seamless',
] as const;
export type DisplayMode = (typeof supportedDisplayModes)[number];
interface PlaygroundViewportProps {
	storage?: StorageType;
	displayMode?: DisplayMode;
	toolbarButtons?: Array<React.ReactElement | false | null>;
	children?: React.ReactNode;
	siteSlug?: string;
}

export const PlaygroundViewport = React.forwardRef<
	HTMLIFrameElement,
	PlaygroundViewportProps
>(({ displayMode = 'browser', toolbarButtons }, ref) => {
	const { playground, currentUrl: url } = usePlaygroundContext();

	if (displayMode === 'seamless') {
		// No need to boot the playground if seamless.
		return <JustViewport iframeRef={ref} />;
	}
	return (
		<BrowserChrome
			initialIsFullSize={displayMode === 'browser-full-screen'}
			showAddressBar={!!playground}
			url={url}
			toolbarButtons={toolbarButtons}
			onUrlChange={(url) => playground?.goTo(url)}
		>
			<JustViewport iframeRef={ref} />
		</BrowserChrome>
	);
});

interface JustViewportProps {
	iframeRef: Ref<HTMLIFrameElement>;
}

const JustViewport = function LoadedViewportComponent({
	iframeRef,
}: JustViewportProps) {
	useEffect(() => {
		const iframe = (iframeRef! as any).current!;
		setupPostMessageRelay(iframe, document.location.origin);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<div className={css.fullSize}>
			<iframe
				id="playground-viewport"
				title="WordPress Playground wrapper (the actual WordPress site is in another, nested iframe)"
				className={css.fullSize}
				ref={iframeRef}
			></iframe>
		</div>
	);
};
