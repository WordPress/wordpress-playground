import { useState } from 'react';
import { usePlaygroundClient } from '../../lib/use-playground-client';
import Modal from '../../components/modal';
import PreviewPRForm from './form';

export function PreviewPRModal() {
	const playground = usePlaygroundClient();
	const [isOpen, setOpen] = useState(true);
	const openModal = () => {
		if (!playground) return;
		setOpen(true);
	};
	const closeModal = () => {
		setOpen(false);
		//onClose();
	};
	function handleImported() {
		// eslint-disable-next-line no-alert
		// alert(
		// 	'File imported! This Playground instance has been updated. Refreshing now.'
		// );
		closeModal();
		playground!.goTo('/');
	}
	return (
		<>
			<Modal
				header={'Preview a WordPress PR'}
				isOpen
				contentLabel='This is a dialog window which overlays the main content of the
				page. The modal begins with a heading 2 called "Import
				Playground". Pressing the Close Import Window will close
				the modal and bring you back to where you were on the page.'
				onRequestClose={closeModal}
			>
				<PreviewPRForm
					playground={playground!}
					onClose={closeModal}
					onImported={handleImported}
					target={'wordpress'}
				/>
			</Modal>
		</>
	);
}
