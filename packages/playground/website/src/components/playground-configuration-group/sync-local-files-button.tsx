import { useState } from 'react';
import Button from '../button';
import { usePlaygroundContext } from '../../playground-context';
import { useSelector } from 'react-redux';
import { PlaygroundReduxState } from '../../lib/redux-store';

export function SyncLocalFilesButton() {
	const { playground, currentUrl } = usePlaygroundContext();
	const opfsHandle = useSelector(
		(state: PlaygroundReduxState) => state.opfsMountDescriptor?.handle
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
						handle: opfsHandle!,
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
