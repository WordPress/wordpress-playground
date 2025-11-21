import { MenuItem } from '@wordpress/components';
import { modalSlugs, setActiveModal } from '../../lib/state/redux/slice-ui';
import type { PlaygroundDispatch } from '../../lib/state/redux/store';
import { useDispatch } from 'react-redux';

interface Props {
	onClose: () => void;
	disabled?: boolean;
}
export function GithubImportMenuItem({ onClose, disabled }: Props) {
	const dispatch: PlaygroundDispatch = useDispatch();
	return (
		<MenuItem
			aria-label="Import WordPress theme, plugin, or wp-content directory from a GitHub repository."
			disabled={disabled}
			onClick={() => {
				dispatch(setActiveModal(modalSlugs.GITHUB_IMPORT));
				onClose();
			}}
		>
			GitHub repository
		</MenuItem>
	);
}
