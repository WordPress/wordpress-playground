import React, { useEffect, useRef } from 'react';

import css from './style.module.css';
import BrowserChrome from '../browser-chrome';
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
import { getDirectoryNameForSlug } from '../../lib/site-storage';

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
	if (displayMode === 'seamless') {
		// No need to boot the playground if seamless.
		return <JustViewport />;
	}
	return (
		<BrowserChrome
			toolbarButtons={toolbarButtons}
			hideToolbar={hideToolbar}
			className={className}
		>
			<JustViewport />
		</BrowserChrome>
	);
};

export const JustViewport = function LoadedViewportComponent() {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const activeSite = useAppSelector((state) => state.activeSite!);

	const dispatch = useAppDispatch();
	useEffect(() => {
		const iframe = iframeRef.current;
		if (!iframe) {
			return;
		}

		let unmounted = false;
		async function doTheWork() {
			let mountDescriptor = undefined;
			if (activeSite.storage === 'opfs') {
				mountDescriptor = {
					device: {
						type: 'opfs',
						path: '/' + getDirectoryNameForSlug(activeSite.slug),
					},
					mountpoint: '/wordpress',
				} as const;
			}

			let playground: PlaygroundClient;
			const iframe = (iframeRef as any)?.current;
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

			// @TODO: Keep the client around for some time to enable quick switching between sites.
			if (unmounted) {
				return;
			}

			setupPostMessageRelay(iframe, document.location.origin);

			dispatch(
				setClientInfo({
					siteSlug: activeSite.slug,
					info: {
						client: playground,
						opfsMountDescriptor: mountDescriptor,
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
	}, [activeSite.slug, iframeRef]);

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
