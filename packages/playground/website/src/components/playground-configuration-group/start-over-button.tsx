import Button from '../button';
import { getActiveClient, useAppSelector } from '../../lib/redux-store';
import { clearContentsFromMountDevice } from '@wp-playground/storage';

export function StartOverButton() {
	const storage = useAppSelector((state) => state.activeSite!.storage);
	const opfsMountDescriptor =
		useAppSelector(getActiveClient)?.opfsMountDescriptor;
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
					opfsMountDescriptor &&
					(storage === 'opfs' || storage === 'local-fs')
				) {
					await clearContentsFromMountDevice(
						opfsMountDescriptor.device
					);
				}
				window.location.reload();
			}}
		>
			Start over
		</Button>
	);
}
