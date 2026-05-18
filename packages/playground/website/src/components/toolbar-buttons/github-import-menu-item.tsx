import { MenuItem } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
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
			aria-label={__(
				'Import WordPress theme, plugin, or wp-content directory from a GitHub repository.',
				'playground-website'
			)}
			disabled={disabled}
			onClick={() => {
				dispatch(setActiveModal(modalSlugs.GITHUB_IMPORT));
				onClose();
			}}
		>
			{__('GitHub repository', 'playground-website')}
		</MenuItem>
	);
}
