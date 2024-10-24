import { MenuItem } from '@wordpress/components';
import { setActiveModal } from '../../lib/state/redux/slice-ui';
import { PlaygroundDispatch } from '../../lib/state/redux/store';
import { useDispatch } from 'react-redux';
import { modalSlugs } from '../layout';

type Props = { onClose: () => void; disabled: boolean };
export function RestoreFromZipMenuItem({ onClose, disabled }: Props) {
	const dispatch: PlaygroundDispatch = useDispatch();

	return (
		<MenuItem
			data-cy="restore-from-zip"
			aria-label="Import a .zip file into the current Playground"
			onClick={() => {
				dispatch(setActiveModal(modalSlugs.IMPORT_FORM));
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
