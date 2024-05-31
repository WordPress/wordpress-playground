import type { Blueprint, StepDefinition } from '@wp-playground/client';

import React, { Ref, useEffect } from 'react';

import css from './style.module.css';
import BrowserChrome from '../browser-chrome';
import { usePlayground } from '../../lib/hooks';
import { StorageType } from '../../types';
import PlaygroundContext from './context';
import { logTrackingEvent } from '../../lib/tracking';

export const supportedDisplayModes = [
	'browser',
	'browser-full-screen',
	'seamless',
] as const;
export type DisplayMode = (typeof supportedDisplayModes)[number];
interface PlaygroundViewportProps {
	storage?: StorageType;
	displayMode?: DisplayMode;
	blueprint?: Blueprint;
	toolbarButtons?: Array<React.ReactElement | false | null>;
	children?: React.ReactNode;
	siteSlug?: string;
}

export default function PlaygroundViewport({
	blueprint,
	displayMode = 'browser',
	storage,
	toolbarButtons,
	children,
	siteSlug,
}: PlaygroundViewportProps) {
	const { playground, url, iframeRef } = usePlayground({
		blueprint,
		storage,
		siteSlug,
	});

	// Add GA events for blueprint steps. For more information, see the README.md file.
	useEffect(() => {
		logTrackingEvent('load');
		// Log the names of provided Blueprint's steps.
		// Only the names (e.g. "runPhp" or "login") are logged. Step options like code, password,
		// URLs are never sent anywhere.
		const steps = (blueprint?.steps || [])
			?.filter((step: any) => !!(typeof step === 'object' && step?.step))
			.map((step) => (step as StepDefinition).step);
		for (const step of steps) {
			logTrackingEvent('step', { step });
		}
	}, [blueprint?.steps]);

	return (
		<PlaygroundContext.Provider
			value={{
				playground,
				currentUrl: url,
			}}
		>
			{displayMode === 'seamless' ? (
				<JustViewport iframeRef={iframeRef} />
			) : (
				<BrowserChrome
					initialIsFullSize={displayMode === 'browser-full-screen'}
					showAddressBar={!!playground}
					url={url}
					toolbarButtons={toolbarButtons}
					onUrlChange={(url) => playground?.goTo(url)}
				>
					<JustViewport iframeRef={iframeRef} />
				</BrowserChrome>
			)}
			{children}
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
				id="playground-viewport"
				title="WordPress Playground wrapper (the actual WordPress site is in another, nested iframe)"
				className={css.fullSize}
				ref={iframeRef}
			></iframe>
		</div>
	);
};
