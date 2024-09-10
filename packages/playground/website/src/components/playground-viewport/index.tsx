import React, { useEffect, useRef } from 'react';

import css from './style.module.css';
import BrowserChrome from '../browser-chrome';
import { useActiveSite, useAppDispatch } from '../../lib/state/redux/store';
import { setupPostMessageRelay } from '@php-wasm/web';
import { PlaygroundClient } from '@wp-playground/remote';
import { getDirectoryPathForSlug } from '../../lib/state/opfs/opfs-site-storage';
import { logger } from '@php-wasm/logger';
import { getRemoteUrl } from '../../lib/config';
import { directoryHandleFromMountDevice } from '@wp-playground/storage';
import {
	Blueprint,
	startPlaygroundWeb,
	StepDefinition,
} from '@wp-playground/client';
import { loadDirectoryHandle } from '../../lib/state/opfs/opfs-directory-handle-storage';
import { logTrackingEvent } from '../../lib/tracking';
import { setActiveModal } from '../../lib/state/redux/slice-ui';
import {
	addClientInfo,
	removeClientInfo,
	updateClientInfo,
} from '../../lib/state/redux/slice-clients';

export const supportedDisplayModes = [
	'browser-full-screen',
	'seamless',
] as const;
export type DisplayMode = (typeof supportedDisplayModes)[number];
interface PlaygroundViewportProps {
	displayMode?: DisplayMode;
	children?: React.ReactNode;
	siteSlug?: string;
	hideToolbar?: boolean;
	className?: string;
}

export const PlaygroundViewport = ({
	displayMode = 'browser-full-screen',
	hideToolbar,
	className,
}: PlaygroundViewportProps) => {
	if (displayMode === 'seamless') {
		// No need to boot the playground if seamless.
		return <JustViewport />;
	}
	return (
		<BrowserChrome hideToolbar={hideToolbar} className={className}>
			<JustViewport />
		</BrowserChrome>
	);
};

export const JustViewport = function LoadedViewportComponent() {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const activeSite = useActiveSite()!;

	const dispatch = useAppDispatch();
	const runtimeConfigString = JSON.stringify(
		activeSite.metadata.runtimeConfiguration
	);
	useEffect(() => {
		const iframe = iframeRef.current;
		if (!iframe) {
			return;
		}

		let unmounted = false;
		async function doTheWork() {
			let mountDescriptor = undefined;
			if (activeSite.metadata.storage === 'opfs') {
				mountDescriptor = {
					device: {
						type: 'opfs',
						path: getDirectoryPathForSlug(activeSite.slug),
					},
					mountpoint: '/wordpress',
				} as const;
			} else if (activeSite.metadata.storage === 'local-fs') {
				mountDescriptor = {
					device: {
						type: 'local-fs',
						handle: await loadDirectoryHandle(activeSite.slug),
					},
					mountpoint: '/wordpress',
				} as const;
				// @TODO: Handle errors, e.g. when the local directory was deleted.
			}

			let isWordPressInstalled = false;
			if (mountDescriptor) {
				isWordPressInstalled = await playgroundAvailableInOpfs(
					await directoryHandleFromMountDevice(mountDescriptor.device)
				);
			}

			logTrackingEvent('load');

			let blueprint: Blueprint;
			if (isWordPressInstalled) {
				blueprint = activeSite.metadata.runtimeConfiguration;
			} else {
				blueprint = activeSite.metadata.originalBlueprint;
				// Log the names of provided Blueprint's steps.
				// Only the names (e.g. "runPhp" or "login") are logged. Step options like
				// code, password, URLs are never sent anywhere.
				const steps = (blueprint?.steps || [])
					?.filter(
						(step: any) =>
							!!(typeof step === 'object' && step?.step)
					)
					.map((step) => (step as StepDefinition).step);
				for (const step of steps) {
					logTrackingEvent('step', { step });
				}
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
			// @TODO: Trash the client if we're staying on the same site slug and only changing the
			//        runtime configuration such as the PHP version.
			if (unmounted) {
				return;
			}

			setupPostMessageRelay(iframe, document.location.origin);

			dispatch(
				addClientInfo({
					siteSlug: activeSite.slug,
					url: '/',
					client: playground,
					opfsMountDescriptor: mountDescriptor,
				})
			);

			playground.onNavigation((url) => {
				dispatch(
					updateClientInfo({
						siteSlug: activeSite.slug,
						changes: {
							url,
						},
					})
				);
			});
		}
		doTheWork();
		return () => {
			unmounted = true;
			dispatch(removeClientInfo(activeSite.slug));
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeSite.slug, iframeRef, runtimeConfigString]);

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

/**
 * Check if the given OPFS directory is a Playground directory.
 *
 * This function is duplicated in @wp-playground/remote package.
 *
 * @TODO: Create a shared package like @wp-playground/wordpress for such utilities
 * and bring in the context detection logic from wp-now – only express it in terms of
 * either abstract FS operations or isomorphic PHP FS operations.
 * (we can't just use Node.js require('fs') in the browser, for example)
 *
 * @TODO: Reuse the "isWordPressInstalled" logic implemented in the boot protocol.
 *        Perhaps mount OPFS first, and only then check for the presence of the
 *        WordPress installation? Or, if not, perhaps implement a shared file access
 * 		  abstraction that can be used both with the PHP module and OPFS directory handles?
 *
 * @param opfs
 */
export async function playgroundAvailableInOpfs(
	opfs: FileSystemDirectoryHandle
) {
	try {
		/**
		 * Assume it's a Playground directory if these files exist:
		 * - wp-config.php
		 * - wp-content/database/.ht.sqlite
		 */
		await opfs.getFileHandle('wp-config.php', { create: false });
		const wpContent = await opfs.getDirectoryHandle('wp-content', {
			create: false,
		});
		const database = await wpContent.getDirectoryHandle('database', {
			create: false,
		});
		await database.getFileHandle('.ht.sqlite', { create: false });
	} catch (e) {
		return false;
	}
	return true;
}
