import { useState } from 'react';
import { MenuItem } from '@wordpress/components';
import { upload } from '@wordpress/icons';

import ImportForm from '../import-form';
import Modal from '../modal';
import { getActiveClient, useAppSelector } from '../../lib/redux-store';

type Props = { onClose: () => void };
export function RestoreFromZipMenuItem({ onClose }: Props) {
	const playground = useAppSelector(getActiveClient)?.client;
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
				icon={upload}
				iconPosition="left"
				data-cy="restore-from-zip"
				aria-label="Download the current playground as a .zip file"
				onClick={openModal}
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
