import { MenuItem } from '@wordpress/components';

interface Props {
	onClose: () => void;
	disabled?: boolean;
}
export function GutenbergPRMenuItem({ onClose, disabled }: Props) {
	return (
		<MenuItem
			aria-label="Preview Gutenberg PR."
			disabled={disabled}
			onClick={() => {
				onClose();
			}}
		>
			Preview a Gutenberg PR
		</MenuItem>
	);
}
