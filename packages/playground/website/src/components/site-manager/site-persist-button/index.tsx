import { useAppSelector, useAppDispatch } from '../../../lib/state/redux/store';
import {
	DropdownMenu,
	DropdownMenuItem,
	DropdownMenuItemLabel,
	DropdownMenuItemHelpText,
	// @ts-ignore
} from '@wordpress/components/build/dropdown-menu-v2/index.js';
import css from './style.module.css';
import { persistTemporarySite } from '../../../lib/state/redux/persist-temporary-site';
import { selectClientInfoBySiteSlug } from '../../../lib/state/redux/slice-clients';
import { useLocalFsAvailability } from '../../../lib/hooks/use-local-fs-availability';

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
	const localFsAvailability = useLocalFsAvailability(clientInfo?.client);
	const dispatch = useAppDispatch();

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
					disabled={localFsAvailability !== 'available'}
					onClick={() =>
						dispatch(persistTemporarySite(siteSlug, 'local-fs'))
					}
				>
					<DropdownMenuItemLabel>
						Save in a local directory
					</DropdownMenuItemLabel>
					{localFsAvailability !== 'available' && (
						<DropdownMenuItemHelpText>
							{localFsAvailability === 'not-available'
								? 'Not available in this browser'
								: 'Not available on this site'}
						</DropdownMenuItemHelpText>
					)}
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
