import { useState } from 'react';
import Button from '../button';
import { useSelector } from 'react-redux';
import {
	getActiveClient,
	useAppSelector,
	type PlaygroundReduxState,
} from '../../lib/redux-store';

export function SyncLocalFilesButton() {
	const clientInfo = useAppSelector(getActiveClient);
	const playground = clientInfo?.client;
	const currentUrl = clientInfo?.url;

	const mountDescriptor = useSelector(
		(state: PlaygroundReduxState) => state.opfsMountDescriptor
	);
	const [isSyncing, setIsSyncing] = useState(false);
	return (
		<Button
			variant="browser-chrome"
			onClick={async () => {
				setIsSyncing(true);
				try {
					const docroot = await playground!.documentRoot;
					await playground!.unmountOpfs(docroot);

					await playground!.mountOpfs({
						device: mountDescriptor!.device,
						mountpoint: docroot,
						initialSyncDirection: 'opfs-to-memfs',
					});
				} finally {
					setIsSyncing(false);
				}
				await playground!.goTo(currentUrl!);
			}}
		>
			{isSyncing ? 'Syncing...' : 'Sync local files'}
		</Button>
	);
}
