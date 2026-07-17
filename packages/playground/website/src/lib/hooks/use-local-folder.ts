import { useState } from 'react';
import { logger } from '@php-wasm/logger';
import {
	getActiveClientInfo,
	useActiveSite,
	useAppSelector,
} from '../state/redux/store';
import { loadDirectoryHandle } from '../state/opfs/opfs-directory-handle-storage';

/**
 * Re-reads the linked local folder into the running Playground so edits made
 * to the files on disk (outside Playground) show up. Re-mounts the local
 * project root, then reloads the page to reflect the new files.
 *
 * Returns whether the refresh succeeded so callers can tell a broken folder
 * link apart from a completed refresh.
 */
export function useReloadFromDisk() {
	const clientInfo = useAppSelector(getActiveClientInfo);
	const [isReloading, setIsReloading] = useState(false);

	const reloadFromDisk = async (): Promise<boolean> => {
		const client = clientInfo?.client;
		const opfsMountDescriptor = clientInfo?.opfsMountDescriptor;
		const url = clientInfo?.url;
		if (!client || !opfsMountDescriptor || !url) {
			return false;
		}
		setIsReloading(true);
		try {
			const mountpoint = opfsMountDescriptor.mountpoint;
			await client.unmountOpfs(mountpoint);
			await client.mountOpfs({
				device: opfsMountDescriptor.device,
				mountpoint,
				initialSyncDirection: 'opfs-to-memfs',
			});
			await client.goTo(url);
			return true;
		} catch (error) {
			logger.error('Error reloading files from the local folder.', error);
			return false;
		} finally {
			setIsReloading(false);
		}
	};

	return { reloadFromDisk, isReloading };
}

/**
 * Loads the active site's linked folder handle for the document-root picker
 * modal. The load can fail after a permission loss, so the error stays with
 * whichever control opened the picker.
 */
export function useDocumentRootPicker() {
	const activeSite = useActiveSite();
	const [directoryHandle, setDirectoryHandle] =
		useState<FileSystemDirectoryHandle | null>(null);
	const [error, setError] = useState('');

	/** Returns whether the picker opened so menus can stay open on failure. */
	const openPicker = async () => {
		if (!activeSite?.metadata.localDirectoryBootConfiguration) {
			return false;
		}
		setError('');
		try {
			setDirectoryHandle(await loadDirectoryHandle(activeSite.slug));
			return true;
		} catch (cause) {
			logger.error('Error loading the local folder handle.', cause);
			setError(
				"Couldn't open the linked folder. Try again, or reopen the project folder from Playgrounds."
			);
			return false;
		}
	};

	const closePicker = () => setDirectoryHandle(null);
	const clearError = () => setError('');

	return { directoryHandle, error, openPicker, closePicker, clearError };
}
