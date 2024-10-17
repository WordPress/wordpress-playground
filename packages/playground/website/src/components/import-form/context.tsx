import React, { createContext, useContext, useState } from 'react';
import { usePlaygroundClient } from '../../lib/use-playground-client';
import ImportForm from './index';
import Modal from '../modal';

const ImportFormContext = createContext({ openModal: () => {}, closeModal: () => {} });

interface ImportFormProviderProps {
	children?: React.ReactNode;
}

const ImportFormProvider = ({ children }: ImportFormProviderProps) => {
	const playground = usePlaygroundClient();
	const [isOpen, setOpen] = useState(false);
	const openModal = () => {
		if (!playground) return;
		setOpen(true);
	};
	const closeModal = () => {
		setOpen(false);
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
		<ImportFormContext.Provider value={{ openModal, closeModal }}>
			{children}

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
		</ImportFormContext.Provider>
	);
};

const useImportForm = () => {
	return useContext(ImportFormContext);
};

export { ImportFormProvider, useImportForm };
