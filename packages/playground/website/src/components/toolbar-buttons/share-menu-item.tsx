import { MenuItem } from '@wordpress/components';
import { modalSlugs, setActiveModal } from '../../lib/state/redux/slice-ui';
import type { PlaygroundDispatch } from '../../lib/state/redux/store';
import { useDispatch } from 'react-redux';

interface Props {
	onClose: () => void;
	disabled?: boolean;
}

export function ShareMenuItem({ onClose, disabled }: Props) {
	const dispatch: PlaygroundDispatch = useDispatch();
	return (
		<MenuItem
			aria-label="Share this Playground with others via a temporary link"
			disabled={disabled}
			onClick={() => {
				dispatch(setActiveModal(modalSlugs.SHARE_PLAYGROUND));
				onClose();
			}}
		>
			Share
		</MenuItem>
	);
}
