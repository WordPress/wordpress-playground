import { MenuItem } from '@wordpress/components';
import { cloudUpload } from '@wordpress/icons';
import { openModal } from '../../github/github-export-form/modal';

interface Props {
	onClose: () => void;
}
export function GithubExportMenuItem({ onClose }: Props) {
	return (
		<MenuItem
			icon={cloudUpload}
			iconPosition="left"
			aria-label="Export WordPress theme, plugin, or wp-content directory to a GitHub repository as a Pull Request."
			onClick={() => {
				openModal();
				onClose();
			}}
		>
			Export Pull Request to GitHub
		</MenuItem>
	);
}
