import { MenuItem } from '@wordpress/components';

interface Props {
	onClose: () => void;
	disabled?: boolean;
}
export function WordPressPRMenuItem({ onClose, disabled }: Props) {
	return (
		<MenuItem
			aria-label="Preview WordPress PR."
			disabled={disabled}
			onClick={() => {
				onClose();
			}}
		>
			Preview a WordPress PR
		</MenuItem>
	);
}
