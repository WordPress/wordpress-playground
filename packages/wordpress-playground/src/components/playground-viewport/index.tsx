import React, { ReactElement, Ref, useMemo } from 'react';
import type {
	ProgressObserver,
	ProgressObserverEvent,
} from '@wordpress/php-wasm';

import css from './style.module.css';
import BrowserChrome from '../browser-chrome';
import ProgressBar from '../progress-bar';
import { usePlayground, useProgressObserver } from '../../hooks';
import type { PlaygroundAPI } from '../../boot-playground';

interface PlaygroundViewportProps {
	isSeamless?: boolean;
	setupPlayground: (
		playground: PlaygroundAPI,
		observer: ProgressObserver
	) => Promise<void>;
	toolbarButtons?: React.ReactElement[];
}

export default function PlaygroundViewport({
	isSeamless,
	setupPlayground,
	toolbarButtons,
}: PlaygroundViewportProps) {
	const { observer, progress } = useProgressObserver();
	const { playground, url, iframeRef } = usePlayground(async function (api) {
		await setupPlayground(api, observer);
	});

	if (isSeamless) {
		return (
			<LoadedViewport
				ready={!!playground}
				loadingProgress={progress}
				iframeRef={iframeRef}
			/>
		);
	}

	const updatedToolbarButtons = useMemo(() => {
		if (!playground || !toolbarButtons?.length) {
			return;
		}
		return toolbarButtons.map((button, index) =>
			React.cloneElement(button as React.ReactElement, {
				key: index,
				playground,
			})
		) as ReactElement[];
	}, [playground, toolbarButtons]);

	return (
		<BrowserChrome
			showAddressBar={!!playground}
			url={url}
			toolbarButtons={updatedToolbarButtons}
			onUrlChange={(url) => playground?.goTo(url)}
		>
			<LoadedViewport
				ready={!!playground}
				loadingProgress={progress}
				iframeRef={iframeRef}
			/>
		</BrowserChrome>
	);
}

interface LoadedViewportProps {
	iframeRef: Ref<HTMLIFrameElement>;
	loadingProgress: ProgressObserverEvent;
	ready: boolean;
}

const LoadedViewport = function LoadedViewportComponent({
	iframeRef,
	loadingProgress,
	ready,
}: LoadedViewportProps) {
	return (
		<div className={css.fullSize}>
			<ProgressBar
				caption={loadingProgress.caption || 'Preparing WordPress...'}
				mode={loadingProgress.mode}
				percentFull={loadingProgress.progress}
				visible={!ready}
			/>
			<iframe className={css.fullSize} ref={iframeRef}></iframe>
		</div>
	);
};
