import { MenuItem } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { modalSlugs, setActiveModal } from '../../lib/state/redux/slice-ui';
import type { PlaygroundDispatch } from '../../lib/state/redux/store';
import { useDispatch } from 'react-redux';

interface Props {
	onClose: () => void;
	disabled?: boolean;
}
export function WordPressPRMenuItem({ onClose, disabled }: Props) {
	const dispatch: PlaygroundDispatch = useDispatch();
	return (
		<MenuItem
			aria-label={__('Preview WordPress Core PR', 'playground-website')}
			disabled={disabled}
			onClick={() => {
				dispatch(setActiveModal(modalSlugs.PREVIEW_PR_WP));
				onClose();
			}}
		>
			{__('WordPress Core PR', 'playground-website')}
		</MenuItem>
	);
}
