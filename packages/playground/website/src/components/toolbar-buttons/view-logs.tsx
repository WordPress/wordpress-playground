import { MenuItem } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { details } from '@wordpress/icons';

import { useDispatch } from 'react-redux';
import type { PlaygroundDispatch } from '../../lib/state/redux/store';
import { modalSlugs, setActiveModal } from '../../lib/state/redux/slice-ui';

type Props = { onClose: () => void };
export function ViewLogs({ onClose }: Props) {
	const dispatch: PlaygroundDispatch = useDispatch();
	return (
		<MenuItem
			icon={details}
			iconPosition="left"
			data-cy="view-logs"
			aria-label={__('View logs', 'playground-website')}
			onClick={() => {
				dispatch(setActiveModal(modalSlugs.LOG));
				onClose();
			}}
		>
			{__('View logs', 'playground-website')}
		</MenuItem>
	);
}
