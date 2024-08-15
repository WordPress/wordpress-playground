import { trash } from '@wordpress/icons';
import { MenuItem } from '@wordpress/components';
import { StorageType } from '../../types';
import { PlaygroundReduxState } from '../../lib/redux-store';
import { useSelector } from 'react-redux';
import { removeContentsFromOpfsPath } from '@wp-playground/storage';

type Props = { onClose: () => void; storage: StorageType };
const opfsStorages: StorageType[] = ['browser', 'device'];
export function ResetSiteMenuItem({ onClose, storage }: Props) {
	const opfsPath = useSelector(
		(state: PlaygroundReduxState) => state.opfsMountDescriptor?.opfsPath
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
				if (opfsPath && opfsStorages.includes(storage)) {
					removeContentsFromOpfsPath(opfsPath);
				}
				window.location.reload();
				onClose();
			}}
		>
			Reset site
		</MenuItem>
	);
}
