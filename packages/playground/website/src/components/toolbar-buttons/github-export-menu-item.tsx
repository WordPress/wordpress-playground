import { MenuItem } from '@wordpress/components';
import { cloudUpload } from '@wordpress/icons';
import { openModal } from '../../github/github-export-form/modal';

interface Props {
	onClose: () => void;
	disabled?: boolean;
}
export function GithubExportMenuItem({ onClose, disabled }: Props) {
	return (
		<MenuItem
			icon={cloudUpload}
			iconPosition="left"
			aria-label="Export WordPress theme, plugin, or wp-content directory to a GitHub repository as a Pull Request."
			disabled={disabled}
			onClick={() => {
				openModal();
				onClose();
			}}
		>
			Export Pull Request to GitHub
		</MenuItem>
	);
}
