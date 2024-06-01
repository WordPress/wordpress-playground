/**
 * Uses the FileSystem access API to synchronize MEMFS changes in a compliant
 * filesystem such as OPFS or local filesystem and restore them on page refresh:
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API
 *
 * Many synchronous functions are await-ed here because some browsers did not
 * catch up yet with the latest spec and still return promises.
 */

/* eslint-disable prefer-rest-params */
import { PHP, UnmountFunction } from '@php-wasm/universal';
import { MountOptions, createDirectoryHandleMountHandler } from '@php-wasm/web';

let unmount: UnmountFunction | undefined;
export type SyncProgress = {
	/** The number of files that have been synced. */
	files: number;
	/** The number of all files that need to be synced. */
	total: number;
};
export type SyncProgressCallback = (progress: SyncProgress) => void;
export type BindOpfsOptions = {
	php: PHP;
	opfs: FileSystemDirectoryHandle;
	initialSyncDirection?: MountOptions['initialSync']['direction'];
	onProgress?: SyncProgressCallback;
	mountpoint: string;
};
export async function bindOpfs({
	php,
	opfs,
	initialSyncDirection,
	mountpoint,
	onProgress,
}: BindOpfsOptions) {
	mountpoint = mountpoint || php.documentRoot;
	initialSyncDirection = initialSyncDirection || 'opfs-to-memfs';

	if (unmount) {
		unmount();
	}

	const mountHandler = createDirectoryHandleMountHandler(opfs, {
		initialSync: {
			direction: initialSyncDirection,
			onProgress,
		},
	});
	unmount = await php.mount(mountpoint, mountHandler);
}

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
