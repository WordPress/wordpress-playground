import { usePlaygroundClient } from '../../lib/use-playground-client';
import ImportForm from './index';
import Modal from '../modal';
import { setActiveModal } from '../../lib/state/redux/slice-ui';
import { PlaygroundDispatch } from '../../lib/state/redux/store';
import { useDispatch } from 'react-redux';

export const ImportFormModal = () => {
	const playground = usePlaygroundClient();
	const dispatch: PlaygroundDispatch = useDispatch();

	const closeModal = () => {
		dispatch(setActiveModal(null));
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
			<Modal
				isOpen={!!playground}
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
	);
};
