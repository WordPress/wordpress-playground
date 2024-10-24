import { MenuItem } from '@wordpress/components';
import { setActiveModal } from '../../lib/state/redux/slice-ui';
import { PlaygroundDispatch } from '../../lib/state/redux/store';
import { useDispatch } from 'react-redux';

interface Props {
	onClose: () => void;
	disabled?: boolean;
}
export function WordPressPRMenuItem({ onClose, disabled }: Props) {
	const dispatch: PlaygroundDispatch = useDispatch();
	return (
		<MenuItem
			aria-label="Preview WordPress PR."
			disabled={disabled}
			onClick={() => {
				dispatch(setActiveModal('preview-pr-wordpress'));
				onClose();
			}}
		>
			Preview a WordPress PR
		</MenuItem>
	);
}
