// import { usePlaygroundContext } from '../../playground-context';
import { useSelector } from 'react-redux';
import { usePlaygroundContext } from '../../playground-context';
import Button from '../button';
import { PlaygroundReduxState } from '../../lib/redux-store';
import { removeDirHandleContents } from '../../opfs';

export function StartOverButton() {
	const { storage } = usePlaygroundContext();
	const opfsHandle = useSelector(
		(state: PlaygroundReduxState) => state.opfsMountDescriptor?.handle
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
					opfsHandle &&
					(storage === 'browser' || storage === 'device')
				) {
					await removeDirHandleContents(opfsHandle);
				}
				window.location.reload();
			}}
		>
			Start over
		</Button>
	);
}
