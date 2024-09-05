import { Blueprint, startPlaygroundWeb } from '@wp-playground/client';
import type { MountDescriptor } from '@wp-playground/client';
import { getRemoteUrl } from './config';
import { logger } from '@php-wasm/logger';
import { playgroundAvailableInOpfs } from '../components/playground-configuration-group/playground-available-in-opfs';
import { directoryHandleFromMountDevice } from '@wp-playground/storage';

export async function bootPlayground({
	blueprint,
	iframe,
	mountDescriptor,
}: {
	blueprint: Blueprint;
	iframe: HTMLIFrameElement;
	mountDescriptor?: Omit<MountDescriptor, 'initialSyncDirection'>;
}) {
	let isWordPressInstalled = false;
	if (mountDescriptor) {
		isWordPressInstalled = await playgroundAvailableInOpfs(
			await directoryHandleFromMountDevice(mountDescriptor.device)
		);
	}

	try {
		return await startPlaygroundWeb({
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
	} catch (error) {
		logger.error(error);
		throw error;
	}
}
