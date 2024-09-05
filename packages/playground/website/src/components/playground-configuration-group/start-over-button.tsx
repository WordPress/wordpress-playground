import { useSelector } from 'react-redux';
import Button from '../button';
import { PlaygroundReduxState, useAppSelector } from '../../lib/redux-store';
import { clearContentsFromMountDevice } from '@wp-playground/storage';

export function StartOverButton() {
	const storage = useAppSelector((state) => state.activeSite!.storage);
	const mountDevice = useSelector(
		(state: PlaygroundReduxState) => state.opfsMountDescriptor?.device
	);
	return (
		<Button
			onClick={async () => {
				if (
					!window.confirm(
						'This will wipe out all data and start a new site. Do you want to proceed?'
					)
				) {
					return;
				}
				if (
					mountDevice &&
					(storage === 'opfs' || storage === 'local-fs')
				) {
					await clearContentsFromMountDevice(mountDevice);
				}
				window.location.reload();
			}}
		>
			Start over
		</Button>
	);
}
