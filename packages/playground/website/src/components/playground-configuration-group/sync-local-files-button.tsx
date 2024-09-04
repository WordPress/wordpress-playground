import { useState } from 'react';
import Button from '../button';
import { usePlaygroundContext } from '../../playground-context';
import { useSelector } from 'react-redux';
import { type PlaygroundReduxState } from '../../lib/webapp-state/redux-store';

export function SyncLocalFilesButton() {
	const { playground, currentUrl } = usePlaygroundContext();
	const mountDescriptor = useSelector(
		(state: PlaygroundReduxState) => state.app.opfsMountDescriptor
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
