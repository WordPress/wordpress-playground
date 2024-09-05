import { trash } from '@wordpress/icons';
import { MenuItem } from '@wordpress/components';
import { PlaygroundReduxState } from '../../lib/redux-store';
import { useSelector } from 'react-redux';
import { clearContentsFromMountDevice } from '@wp-playground/storage';
import { SiteStorageType } from '../../lib/site-storage';

type Props = { onClose: () => void };
const opfsStorages: SiteStorageType[] = ['opfs', 'local-fs'];
export function ResetSiteMenuItem({ onClose }: Props) {
	const mountDescriptor = useSelector(
		(state: PlaygroundReduxState) => state.opfsMountDescriptor
	);
	const storage = useSelector(
		(state: PlaygroundReduxState) => state.activeSite!.storage
	);
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
				if (mountDescriptor && opfsStorages.includes(storage)) {
					await clearContentsFromMountDevice(mountDescriptor.device);
				}
				window.location.reload();
				onClose();
			}}
		>
			Reset site
		</MenuItem>
	);
}
