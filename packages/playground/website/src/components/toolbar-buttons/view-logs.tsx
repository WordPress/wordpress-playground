import { MenuItem } from '@wordpress/components';
import { details } from '@wordpress/icons';

import { useDispatch } from 'react-redux';
import {
	PlaygroundDispatch,
	setActiveModal,
} from '../../lib/state/redux/store';

type Props = { onClose: () => void };
export function ViewLogs({ onClose }: Props) {
	const dispatch: PlaygroundDispatch = useDispatch();
	return (
		<MenuItem
			icon={details}
			iconPosition="left"
			data-cy="view-logs"
			aria-label="View logs"
			onClick={() => {
				dispatch(setActiveModal('log'));
				onClose();
			}}
		>
			View logs
		</MenuItem>
	);
}
