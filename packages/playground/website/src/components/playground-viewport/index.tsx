import React, { useEffect, useRef } from 'react';

import css from './style.module.css';
import BrowserChrome from '../browser-chrome';
import { usePlaygroundContext } from '../../playground-context';
import {
	forgetClientInfo,
	setActiveModal,
	setClientInfo,
	useAppDispatch,
	useAppSelector,
} from '../../lib/redux-store';
import { setupPostMessageRelay } from '@php-wasm/web';
import { bootPlayground } from '../../lib/boot-playground';
import { PlaygroundClient } from '@wp-playground/remote';

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

	const activeSite = useAppSelector((state) => state.activeSite!);
	const mountDescriptor = useAppSelector(
		(state) => state.opfsMountDescriptor
	);

	const dispatch = useAppDispatch();
	useEffect(() => {
		let unmounted = false;
		async function doTheWork() {
			const iframe = (iframeRef as any)?.current;
			let playground: PlaygroundClient;

			console.log('booting playground');

			try {
				playground = await bootPlayground({
					blueprint: activeSite.originalBlueprint!,
					iframe,
					mountDescriptor,
				});
			} catch (e) {
				dispatch(setActiveModal('error-report'));
				return;
			}

			// @TODO: Set the client immediately, delete it after a timeout.
			if (unmounted) {
				return;
			}

			dispatch(
				setClientInfo({
					siteSlug: activeSite.slug,
					info: {
						client: playground,
					},
				})
			);

			playground.onNavigation((url) => {
				dispatch(
					setClientInfo({
						siteSlug: activeSite.slug,
						info: {
							url,
						},
					})
				);
			});
		}
		// Give React a chance to re-render the iframe.
		doTheWork();
		return () => {
			unmounted = true;
			dispatch(forgetClientInfo(activeSite.slug));
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeSite.slug, !!iframe]);

	console.log('rendering viewport with key', activeSite.slug);

	return (
		<div className={css.fullSize}>
			<iframe
				id="playground-viewport"
				key={activeSite.slug}
				title="WordPress Playground wrapper (the actual WordPress site is in another, nested iframe)"
				className={css.fullSize}
				ref={iframeRef}
			></iframe>
		</div>
	);
};
