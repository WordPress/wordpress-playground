import { useState } from 'react';
import Button from '../button';
import { getActiveClient, useAppSelector } from '../../lib/redux-store';

export function SyncLocalFilesButton() {
	const { client, url, opfsMountDescriptor } =
		useAppSelector(getActiveClient) || {};
	const [isSyncing, setIsSyncing] = useState(false);
	return (
		<Button
			variant="browser-chrome"
			onClick={async () => {
				setIsSyncing(true);
				try {
					const docroot = await client!.documentRoot;
					await client!.unmountOpfs(docroot);

					await client!.mountOpfs({
						device: opfsMountDescriptor!.device,
						mountpoint: docroot,
						initialSyncDirection: 'opfs-to-memfs',
					});
				} finally {
					setIsSyncing(false);
				}
				await client!.goTo(url!);
			}}
		>
			{isSyncing ? 'Syncing...' : 'Sync local files'}
		</Button>
	);
}
