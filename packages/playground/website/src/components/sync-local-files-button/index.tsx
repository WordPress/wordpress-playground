import { useState } from 'react';
import Button from '../button';
import {
	getActiveClientInfo,
	useAppSelector,
} from '../../lib/state/redux/store';

export function SyncLocalFilesButton() {
	const { client, url, opfsMountDescriptor } =
		useAppSelector(getActiveClientInfo) || {};
	const [isSyncing, setIsSyncing] = useState(false);
	return (
		<Button
			variant="browser-chrome"
			onClick={async () => {
				setIsSyncing(true);
				try {
					const mountpoint = opfsMountDescriptor!.mountpoint;
					await client!.unmountOpfs(mountpoint);

					await client!.mountOpfs({
						device: opfsMountDescriptor!.device,
						mountpoint,
						initialSyncDirection: 'opfs-to-memfs',
					});
					// @TODO Report error to avoid confusion on silent failure.
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
