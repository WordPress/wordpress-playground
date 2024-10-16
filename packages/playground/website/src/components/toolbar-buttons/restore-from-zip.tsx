import { MenuItem } from '@wordpress/components';
import { useImportForm } from '../import-form/context';

type Props = { onClose: () => void; disabled: boolean };
export function RestoreFromZipMenuItem({ onClose, disabled }: Props) {
	const { openModal } = useImportForm();

	return (
		<MenuItem
			data-cy="restore-from-zip"
			aria-label="Import a .zip file into the current Playground"
			onClick={() => {
				openModal();
				if (typeof onClose === 'function') {
					onClose();
				}
			}}
			disabled={disabled}
		>
			Restore from .zip
		</MenuItem>
	);
}
