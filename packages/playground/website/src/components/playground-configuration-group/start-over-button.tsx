import { useSelector } from 'react-redux';
import { usePlaygroundContext } from '../../playground-context';
import Button from '../button';
import { PlaygroundReduxState } from '../../lib/redux-store';
import { clearContentsFromMountDevice } from '@wp-playground/storage';

export function StartOverButton() {
	const { storage } = usePlaygroundContext();
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
					(storage === 'browser' || storage === 'device')
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
