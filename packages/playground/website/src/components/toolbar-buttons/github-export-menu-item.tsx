import { MenuItem } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { modalSlugs, setActiveModal } from '../../lib/state/redux/slice-ui';
import type { PlaygroundDispatch } from '../../lib/state/redux/store';
import { useDispatch } from 'react-redux';

interface Props {
	onClose: () => void;
	disabled?: boolean;
}
export function GithubExportMenuItem({ onClose, disabled }: Props) {
	const dispatch: PlaygroundDispatch = useDispatch();
	return (
		<MenuItem
			aria-label={__(
				'Export WordPress theme, plugin, or wp-content directory to a GitHub repository as a pull request.',
				'playground-website'
			)}
			disabled={disabled}
			onClick={() => {
				dispatch(setActiveModal(modalSlugs.GITHUB_EXPORT));
				onClose();
			}}
		>
			{__('Export to GitHub', 'playground-website')}
		</MenuItem>
	);
}
