import { useState } from 'react';
import { MenuItem } from '@wordpress/components';

import ImportForm from '../import-form';
import Modal from '../modal';
import { usePlaygroundClient } from '../../lib/use-playground-client';

type Props = { onClose: () => void; disabled: boolean };
export function RestoreFromZipMenuItem({ onClose, disabled }: Props) {
	const playground = usePlaygroundClient();
	const [isOpen, setOpen] = useState(false);
	const openModal = () => {
		if (!playground) return;
		setOpen(true);
	};
	const closeModal = () => {
		setOpen(false);
		onClose();
	};
	function handleImported() {
		// eslint-disable-next-line no-alert
		alert(
			'File imported! This Playground instance has been updated. Refreshing now.'
		);
		closeModal();
		playground!.goTo('/');
	}
	return (
		<>
			<MenuItem
				data-cy="restore-from-zip"
				aria-label="Import a .zip file into the current Playground"
				onClick={openModal}
				disabled={disabled}
			>
				Restore from .zip
			</MenuItem>

			<Modal
				isOpen={isOpen}
				contentLabel='This is a dialog window which overlays the main content of the
				page. The modal begins with a heading 2 called "Import
				Playground". Pressing the Close Import Window will close
				the modal and bring you back to where you were on the page.'
				onRequestClose={closeModal}
			>
				<ImportForm
					playground={playground!}
					onClose={closeModal}
					onImported={handleImported}
				/>
			</Modal>
		</>
	);
}
