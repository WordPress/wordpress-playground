import { MenuItem } from '@wordpress/components';
import { bug } from '@wordpress/icons';

import { usePlaygroundContext } from '../../playground-context';

type Props = { onClose: () => void };
export function ReportError({ onClose }: Props) {
	const { setActiveModal } = usePlaygroundContext();
	return (
		<MenuItem
			icon={bug}
			iconPosition="left"
			data-cy="report-error"
			aria-label="Report an error in Playground"
			onClick={() => {
				setActiveModal('error-report');
				onClose();
			}}
		>
			Report error
		</MenuItem>
	);
}
