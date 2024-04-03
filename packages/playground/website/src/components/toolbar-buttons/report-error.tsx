import { MenuItem } from '@wordpress/components';
import { bug } from '@wordpress/icons';

import { usePlaygroundContext } from '../../playground-context';

type Props = { onClose: () => void };
export function ReportError({ onClose }: Props) {
	const { setShowErrorModal } = usePlaygroundContext();
	return (
		<MenuItem
			icon={bug}
			iconPosition="left"
			data-cy="report-error"
			aria-label="Report an error in Playground"
			onClick={() => {
				setShowErrorModal(true);
				onClose();
			}}
		>
			Report error
		</MenuItem>
	);
}
