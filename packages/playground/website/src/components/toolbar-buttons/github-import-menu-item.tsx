import { MenuItem } from '@wordpress/components';
import { openModal } from '../../github/github-import-form/modal';

interface Props {
	onClose: () => void;
	disabled?: boolean;
}
export function GithubImportMenuItem({ onClose, disabled }: Props) {
	return (
		<MenuItem
			aria-label="Import WordPress theme, plugin, or wp-content directory from a GitHub repository."
			disabled={disabled}
			onClick={() => {
				openModal();
				onClose();
			}}
		>
			Import from GitHub
		</MenuItem>
	);
}
