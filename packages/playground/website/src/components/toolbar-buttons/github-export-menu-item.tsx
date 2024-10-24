import { MenuItem } from '@wordpress/components';
import { openModal } from '../../github/github-export-form/modal';

interface Props {
	onClose: () => void;
	disabled?: boolean;
}
export function GithubExportMenuItem({ onClose, disabled }: Props) {
	return (
		<MenuItem
			aria-label="Export WordPress theme, plugin, or wp-content directory to a GitHub repository as a Pull Request."
			disabled={disabled}
			onClick={() => {
				openModal();
				onClose();
			}}
		>
			Export PR to GitHub
		</MenuItem>
	);
}
