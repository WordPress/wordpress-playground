import { useAppSelector, useAppDispatch } from '../../../lib/state/redux/store';
import {
	DropdownMenu,
	DropdownMenuItem,
	DropdownMenuItemLabel,
	// @ts-ignore
} from '@wordpress/components/build/dropdown-menu-v2/index.js';
import css from './style.module.css';
import { persistTemporarySite } from '../../../lib/state/redux/persist-temporary-site';
import { selectClientInfoBySiteSlug } from '../../../lib/state/redux/slice-clients';

export function SitePersistButton({
	siteSlug,
	children,
}: {
	siteSlug: string;
	children: React.ReactNode;
}) {
	const clientInfo = useAppSelector((state) =>
		selectClientInfoBySiteSlug(state, siteSlug)
	);
	const dispatch = useAppDispatch();

	// @TODO: The parent component should be aware if local FS is unavailable so that it
	//        can adjust the UI accordingly.
	// 		  Also, acknowledge Safari doesn't support local FS yet as we cannot pass the directory
	//        handle to the worker. Perhaps we could work around this by triggering showDirectoryPicker
	//        from the worker thread.
	if (!clientInfo?.opfsIsSyncing) {
		return (
			<DropdownMenu trigger={children}>
				<DropdownMenuItem
					onClick={() =>
						dispatch(persistTemporarySite(siteSlug, 'opfs'))
					}
				>
					<DropdownMenuItemLabel>
						Save in this browser
					</DropdownMenuItemLabel>
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() =>
						dispatch(persistTemporarySite(siteSlug, 'local-fs'))
					}
				>
					<DropdownMenuItemLabel>
						Save in a local directory
					</DropdownMenuItemLabel>
				</DropdownMenuItem>
			</DropdownMenu>
		);
	}

	if (!clientInfo?.opfsSyncProgress) {
		return (
			<div className={css.progressInfo}>
				<div>
					<progress id="file" max="100" value="0"></progress>
				</div>
				<div>Preparing to save...</div>
			</div>
		);
	}

	return (
		<div className={css.progressInfo}>
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
		</div>
	);
}
