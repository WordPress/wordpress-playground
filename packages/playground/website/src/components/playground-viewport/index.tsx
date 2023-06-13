import type { Blueprint } from '@wp-playground/client';

import React, { ReactElement, Ref, useMemo } from 'react';

import css from './style.module.css';
import BrowserChrome from '../browser-chrome';
import { usePlayground } from '../../lib/hooks';

interface PlaygroundViewportProps {
	persistent?: boolean;
	isSeamless?: boolean;
	blueprint?: Blueprint;
	toolbarButtons?: Array<React.ReactElement | false | null>;
}

export default function PlaygroundViewport({
	blueprint,
	isSeamless,
	persistent,
	toolbarButtons,
}: PlaygroundViewportProps) {
	const { playground, url, iframeRef } = usePlayground({
		blueprint,
		persistent,
	});

	const updatedToolbarButtons = useMemo(() => {
		if (isSeamless || !playground || !toolbarButtons?.length) {
			return;
		}
		return toolbarButtons
			.filter((x) => x)
			.map((button, index) =>
				React.cloneElement(button as React.ReactElement, {
					key: index,
					playground,
				})
			) as ReactElement[];
	}, [isSeamless, playground, toolbarButtons]);

	if (isSeamless) {
		return <JustViewport iframeRef={iframeRef} />;
	}

	return (
		<BrowserChrome
			showAddressBar={!!playground}
			url={url}
			toolbarButtons={updatedToolbarButtons}
			onUrlChange={(url) => playground?.goTo(url)}
		>
			<JustViewport iframeRef={iframeRef} />
		</BrowserChrome>
	);
}

interface JustViewportProps {
	iframeRef: Ref<HTMLIFrameElement>;
}

const JustViewport = function LoadedViewportComponent({
	iframeRef,
}: JustViewportProps) {
	return (
		<div className={css.fullSize}>
			<iframe
				title="Playground Viewport"
				className={css.fullSize}
				ref={iframeRef}
			></iframe>
		</div>
	);
};
