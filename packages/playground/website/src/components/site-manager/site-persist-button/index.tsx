import { Button } from '@wordpress/components';
import {
	useAppSelector,
	useAppDispatch,
	saveSiteToDevice,
} from '../../../lib/redux-store';

export function SitePersistButton({
	siteSlug,
	mode,
	children,
}: {
	siteSlug: string;
	mode: 'local-fs' | 'opfs';
	children: React.ReactNode;
}) {
	const clientInfo = useAppSelector((state) => state.clients[siteSlug]);
	const dispatch = useAppDispatch();

	const isSyncing =
		clientInfo?.opfsIsSyncing &&
		clientInfo?.opfsMountDescriptor?.device.type === mode;
	// @TODO: The parent component should be aware if local FS is unavailable so that it
	//        can adjust the UI accordingly.
	// 		  Also, acknowledge Safari doesn't support local FS yet as we cannot pass the directory
	//        handle to the worker. Perhaps we could work around this by triggering showDirectoryPicker
	//        from the worker thread.
	if (!isSyncing) {
		return (
			<Button
				variant="primary"
				disabled={!clientInfo?.client}
				onClick={async () => {
					dispatch(saveSiteToDevice(siteSlug, mode));
				}}
			>
				{children}
			</Button>
		);
	}

	if (!clientInfo?.opfsSyncProgress) {
		return (
			<>
				<div>
					<progress id="file" max="100" value="0"></progress>
				</div>
				<div>Preparing to save...</div>
			</>
		);
	}

	return (
		<>
			<div>
				<progress
					id="file"
					max={clientInfo.opfsSyncProgress.total}
					value={clientInfo.opfsSyncProgress.files}
				></progress>
			</div>
			<div>
				{clientInfo.opfsSyncProgress.files}
				{' / '}
				{clientInfo.opfsSyncProgress.total} files saved
			</div>
		</>
	);
}
