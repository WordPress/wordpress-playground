import { MenuItem } from '@wordpress/components';
import { bug } from '@wordpress/icons';

import { useDispatch } from 'react-redux';
import { PlaygroundDispatch, setActiveModal } from '../../lib/redux-store';

type Props = { onClose: () => void };
export function ReportError({ onClose }: Props) {
	const dispatch: PlaygroundDispatch = useDispatch();
	return (
		<MenuItem
			icon={bug}
			iconPosition="left"
			data-cy="report-error"
			aria-label="Report an error in Playground"
			onClick={() => {
				dispatch(setActiveModal('error-report'));
				onClose();
			}}
		>
			Report error
		</MenuItem>
	);
}
