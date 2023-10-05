import type { Blueprint } from '@wp-playground/client';

import React, { Ref } from 'react';

import css from './style.module.css';
import BrowserChrome from '../browser-chrome';
import { usePlayground } from '../../lib/hooks';
import { StorageType } from '../../types';
import PlaygroundContext from './context';

interface PlaygroundViewportProps {
	storage?: StorageType;
	isSeamless?: boolean;
	blueprint?: Blueprint;
	toolbarButtons?: Array<React.ReactElement | false | null>;
}

export default function PlaygroundViewport({
	blueprint,
	isSeamless,
	storage,
	toolbarButtons,
}: PlaygroundViewportProps) {
	const { playground, url, iframeRef } = usePlayground({
		blueprint,
		storage,
	});

	return (
		<PlaygroundContext.Provider
			value={{
				playground,
				currentUrl: url,
			}}
		>
			{isSeamless ? (
				<JustViewport iframeRef={iframeRef} />
			) : (
				<BrowserChrome
					showAddressBar={!!playground}
					url={url}
					toolbarButtons={toolbarButtons}
					onUrlChange={(url) => playground?.goTo(url)}
				>
					<JustViewport iframeRef={iframeRef} />
				</BrowserChrome>
			)}
		</PlaygroundContext.Provider>
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
				title="WordPress Playground wrapper (the actual WordPress site is in another, nested iframe)"
				className={css.fullSize}
				ref={iframeRef}
			></iframe>
		</div>
	);
};
