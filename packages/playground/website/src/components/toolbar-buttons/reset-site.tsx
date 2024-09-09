import { trash } from '@wordpress/icons';
import { MenuItem } from '@wordpress/components';
import {
	getActiveClient,
	useActiveSite,
	useAppSelector,
} from '../../lib/redux-store';
import { clearContentsFromMountDevice } from '@wp-playground/storage';
import { SiteStorageType } from '../../lib/site-storage';

type Props = { onClose: () => void };
const opfsStorages: SiteStorageType[] = ['opfs', 'local-fs'];
export function ResetSiteMenuItem({ onClose }: Props) {
	const opfsMountDescriptor =
		useAppSelector(getActiveClient)?.opfsMountDescriptor;
	const storage = useActiveSite()!.metadata.storage;
	return (
		<MenuItem
			icon={trash}
			iconPosition="left"
			aria-label="Resets the current playground site and starts a new one."
			onClick={async () => {
				if (
					!window.confirm(
						'This will wipe out all data and start a new site. Do you want to proceed?'
					)
				) {
					onClose();
					return;
				}
				if (opfsMountDescriptor && opfsStorages.includes(storage)) {
					await clearContentsFromMountDevice(
						opfsMountDescriptor.device
					);
				}
				window.location.reload();
				onClose();
			}}
		>
			Reset site
		</MenuItem>
	);
}
