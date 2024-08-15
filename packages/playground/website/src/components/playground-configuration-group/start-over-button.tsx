// import { usePlaygroundContext } from '../../playground-context';
import { useSelector } from 'react-redux';
import { usePlaygroundContext } from '../../playground-context';
import Button from '../button';
import { PlaygroundReduxState } from '../../lib/redux-store';
import { removeContentsFromOpfsPath } from '@wp-playground/storage';

export function StartOverButton() {
	const { storage } = usePlaygroundContext();
	const opfsPath = useSelector(
		(state: PlaygroundReduxState) => state.opfsMountDescriptor?.opfsPath
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
					opfsPath &&
					(storage === 'browser' || storage === 'device')
				) {
					await removeContentsFromOpfsPath(opfsPath);
				}
				window.location.reload();
			}}
		>
			Start over
		</Button>
	);
}
