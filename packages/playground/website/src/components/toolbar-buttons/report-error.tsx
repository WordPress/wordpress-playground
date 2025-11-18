import { MenuItem } from '@wordpress/components';

type Props = { onClose: () => void; disabled?: boolean };
export function ReportError({ onClose, disabled }: Props) {
	return (
		<MenuItem
			data-cy="report-error"
			aria-label="Report an error in Playground"
			disabled={disabled}
			href="https://github.com/WordPress/wordpress-playground/issues/new/choose"
			target="_blank"
			rel="noopener noreferrer"
			onClick={onClose}
		>
			Report error
		</MenuItem>
	);
}
