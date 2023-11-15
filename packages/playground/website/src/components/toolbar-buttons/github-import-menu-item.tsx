import { MenuItem } from '@wordpress/components';
import { cloud } from '@wordpress/icons';
import { openModal } from '../../github/github-import-form/modal';

interface Props {
	onClose: () => void;
}
export function GithubImportMenuItem({ onClose }: Props) {
	return (
		<MenuItem
			icon={cloud}
			iconPosition="left"
			aria-label="Import WordPress theme, plugin, or wp-content directory from a GitHub repository."
			onClick={() => {
				openModal();
				onClose();
			}}
		>
			Import from GitHub
		</MenuItem>
	);
}
