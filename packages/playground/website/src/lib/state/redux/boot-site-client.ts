import { directoryHandleFromMountDevice } from '@wp-playground/storage';
import { loadDirectoryHandle } from '../opfs/opfs-directory-handle-storage';
import { getDirectoryPathForSlug } from '../opfs/opfs-site-storage';
import {
	addClientInfo,
	removeClientInfo,
	updateClientInfo,
} from './slice-clients';
import { logTrackingEvent } from '../../tracking';
import { Blueprint, StepDefinition } from '@wp-playground/blueprints';
import { logger } from '@php-wasm/logger';
import { setupPostMessageRelay } from '@php-wasm/web';
import { startPlaygroundWeb } from '@wp-playground/client';
import { PlaygroundClient } from '@wp-playground/remote';
import { getRemoteUrl } from '../../config';
import { setActiveModal } from './slice-ui';
import { PlaygroundDispatch, PlaygroundReduxState } from './store';
import { selectSiteBySlug } from './slice-sites';

export function bootSiteClient(
	siteSlug: string,
	iframe: HTMLIFrameElement,
	{ signal }: { signal: AbortSignal }
) {
	return async (
		dispatch: PlaygroundDispatch,
		getState: () => PlaygroundReduxState
	) => {
		signal.onabort = () => {
			dispatch(removeClientInfo(siteSlug));
		};
		const site = selectSiteBySlug(getState(), siteSlug);

		let mountDescriptor = undefined;
		if (site.metadata.storage === 'opfs') {
			mountDescriptor = {
				device: {
					type: 'opfs',
					path: getDirectoryPathForSlug(site.slug),
				},
				mountpoint: '/wordpress',
			} as const;
		} else if (site.metadata.storage === 'local-fs') {
			mountDescriptor = {
				device: {
					type: 'local-fs',
					handle: await loadDirectoryHandle(site.slug),
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
			blueprint = site.metadata.runtimeConfiguration;
		} else {
			blueprint = site.metadata.originalBlueprint;
			// Log the names of provided Blueprint's steps.
			// Only the names (e.g. "runPhp" or "login") are logged. Step options like
			// code, password, URLs are never sent anywhere.
			const steps = (blueprint?.steps || [])
				?.filter(
					(step: any) => !!(typeof step === 'object' && step?.step)
				)
				.map((step) => (step as StepDefinition).step);
			for (const step of steps) {
				logTrackingEvent('step', { step });
			}
		}

		let playground: PlaygroundClient;
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
		if (signal.aborted) {
			return;
		}

		setupPostMessageRelay(iframe, document.location.origin);

		dispatch(
			addClientInfo({
				siteSlug: site.slug,
				url: '/',
				client: playground,
				opfsMountDescriptor: mountDescriptor,
			})
		);

		playground.onNavigation((url) => {
			dispatch(
				updateClientInfo({
					siteSlug: site.slug,
					changes: {
						url,
					},
				})
			);
		});

		signal.onabort = null;
	};
}

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
