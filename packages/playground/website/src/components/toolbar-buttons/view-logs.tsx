import { MenuItem } from '@wordpress/components';
import { details } from '@wordpress/icons';

import { usePlaygroundContext } from '../../playground-context';

type Props = { onClose: () => void };
export function ViewLogs({ onClose }: Props) {
	const { setActiveModal } = usePlaygroundContext();
	return (
		<MenuItem
			icon={details}
			iconPosition="left"
			data-cy="view-logs"
			aria-label="View logs"
			onClick={() => {
				setActiveModal('log');
				onClose();
			}}
		>
			View logs
		</MenuItem>
	);
}
