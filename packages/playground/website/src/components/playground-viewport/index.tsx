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
import { PlaygroundClient } from '@wp-playground/remote';
import { getDirectoryNameForSlug } from '../../lib/site-storage';
import { logger } from '@php-wasm/logger';
import { getRemoteUrl } from '../../lib/config';
import { playgroundAvailableInOpfs } from '../playground-configuration-group/playground-available-in-opfs';
import { directoryHandleFromMountDevice } from '@wp-playground/storage';
import { Blueprint, startPlaygroundWeb } from '@wp-playground/client';

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

			let isWordPressInstalled = false;
			if (mountDescriptor) {
				isWordPressInstalled = await playgroundAvailableInOpfs(
					await directoryHandleFromMountDevice(mountDescriptor.device)
				);
			}

			let blueprint: Blueprint = activeSite.originalBlueprint || {};
			if (isWordPressInstalled) {
				// Only apply the runtime configuration if WordPress is already installed.
				// We assume the Blueprint steps were already executed. We don't want to
				// execute them again as, e.g. installing the same plugin twice could break
				// the site or lead to a data loss.
				// @TODO: Separate the runtime configuration from the blueprint.
				// @TODO: Source the runtime configuration from the site data, not from
				//        the original blueprint.
				// @TODO: Spend more time here in general and make sure we can distinguish between the
				//        initial Blueprint, the current runtime configuration, move the site between
				//        different storage types, etc. Ideally we'd end up with a few clearly specified
				//        operations and data formats, and stop relying on query parameters so much.
				//        ?storage=browser is difficult to think about when we're considering operations like
				//        "make this temporary site permanent" or "export to local directory" or "save to github".
				blueprint = {
					// @TODO: Store networking in the site data.
					// features: blueprint.features,
					phpExtensionBundles: [activeSite.phpExtensionBundle],
					// @TODO: Store extraLibraries in the site data. Or not?
					// extraLibraries: blueprint.extraLibraries,
					// @TODO: Store the `login` flag in the site data. Or not?
					// login: activeSite.login,
					constants: activeSite.originalBlueprint?.constants,
					preferredVersions: {
						php: activeSite.phpVersion,
						wp: activeSite.wpVersion,
					},
				};
			}

			let playground: PlaygroundClient;
			const iframe = (iframeRef as any)?.current;
			try {
				playground = await startPlaygroundWeb({
					iframe: iframe!,
					remoteUrl: getRemoteUrl().toString(),
					blueprint,
					// Intercept the Playground client even if the
					// Blueprint fails.
					onClientConnected: (playground) => {
						(window as any)['playground'] = playground;
					},
					mounts: mountDescriptor
						? [
								{
									...mountDescriptor,
									initialSyncDirection: 'opfs-to-memfs',
								},
						  ]
						: [],
					shouldInstallWordPress: !isWordPressInstalled,
				});
			} catch (e) {
				logger.error(e);
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
