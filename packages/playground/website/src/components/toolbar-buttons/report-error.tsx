import { MenuItem } from '@wordpress/components';

type Props = { onClose: () => void; disabled?: boolean };
export function ReportError({ onClose, disabled }: Props) {
	return (
		<MenuItem
			data-cy="report-error"
			aria-label="Report an error in Playground"
			disabled={disabled}
			onClick={() => {
				onClose();
				window.open(
					'https://github.com/WordPress/wordpress-playground/issues/new/choose',
					'_blank',
					'noopener,noreferrer'
				);
			}}
		>
			Report error
		</MenuItem>
	);
}
