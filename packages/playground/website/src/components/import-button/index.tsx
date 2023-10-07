import { useState } from 'react';
import css from './style.module.css';
import ImportForm from '../import-form';
import Modal from '../modal';
import { usePlaygroundContext } from '../playground-viewport/context';

export default function ImportButton() {
	const [isOpen, setOpen] = useState(false);
	const openModal = () => setOpen(true);
	const closeModal = () => setOpen(false);
	const { playground } = usePlaygroundContext();
	function handleImported() {
		// eslint-disable-next-line no-alert
		alert(
			'File imported! This Playground instance has been updated. Refreshing now.'
		);
		closeModal();
		playground!.goTo('/');
	}
	if (!playground) {
		return null;
	}

	const importButtonAriaLabel = 'Open Playground import window';

	return (
		<>
			<button
				id="import-open-modal--btn"
				className={css.btn}
				aria-label={importButtonAriaLabel}
				title={importButtonAriaLabel}
				onClick={openModal}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					width="28"
					height="28"
					aria-hidden="true"
					focusable="false"
				>
					<path
						fill="#ffffff"
						d="M18.5 15v3.5H13V6.7l4.5 4.1 1-1.1-6.2-5.8-5.8 5.8 1 1.1 4-4v11.7h-6V15H4v5h16v-5z"
					></path>
				</svg>
			</button>

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
