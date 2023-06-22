import { useState } from 'react';
import Button from '../button';
import { usePlaygroundContext } from '../playground-viewport/context';

export function SyncLocalFilesButton() {
	const { playground, currentUrl } = usePlaygroundContext();
	const [isSyncing, setIsSyncing] = useState(false);
	return (
		<Button
			onClick={async () => {
				setIsSyncing(true);
				try {
					await playground!.reloadFilesFromOpfs();
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
