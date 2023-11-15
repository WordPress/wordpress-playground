import { MenuItem } from '@wordpress/components';
import { cloudUpload } from '@wordpress/icons';
import { isGitHubExportModalOpen } from '../../github/github-export-form/modal';

interface Props {
	onClose: () => void;
}
export function GithubExportMenuItem({ onClose }: Props) {
	return (
		<MenuItem
			icon={cloudUpload}
			iconPosition="left"
			aria-label="Export WordPress theme, plugin, or wp-content directory to a GitHub repository."
			onClick={() => {
				isGitHubExportModalOpen.value = true;
				onClose();
			}}
		>
			GitHub Pull Request
		</MenuItem>
	);
}
