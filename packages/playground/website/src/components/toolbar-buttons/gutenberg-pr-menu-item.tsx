import { MenuItem } from '@wordpress/components';
import { setActiveModal } from '../../lib/state/redux/slice-ui';
import { PlaygroundDispatch } from '../../lib/state/redux/store';
import { useDispatch } from 'react-redux';

interface Props {
	onClose: () => void;
	disabled?: boolean;
}
export function GutenbergPRMenuItem({ onClose, disabled }: Props) {
	const dispatch: PlaygroundDispatch = useDispatch();
	return (
		<MenuItem
			aria-label="Preview Gutenberg PR."
			disabled={disabled}
			onClick={() => {
				dispatch(setActiveModal('preview-pr-gutenberg'));
				onClose();
			}}
		>
			Preview a Gutenberg PR
		</MenuItem>
	);
}
