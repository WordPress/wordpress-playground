import { usePlaygroundClient } from '../../lib/use-playground-client';
import Modal from '../../components/modal';
import PreviewPRForm from './form';
import { setActiveModal } from '../../lib/state/redux/slice-ui';
import { PlaygroundDispatch } from '../../lib/state/redux/store';
import { useDispatch } from 'react-redux';

interface PreviewPRModalProps {
	target: 'wordpress' | 'gutenberg';
}

const targetName = {
	'wordpress': 'WordPress',
	'gutenberg': 'Gutenberg'
}

export function PreviewPRModal({ target }: PreviewPRModalProps) {
	const playground = usePlaygroundClient();
	const dispatch: PlaygroundDispatch = useDispatch();
	const closeModal = () => {
		dispatch(setActiveModal(null));
	};
	function handleImported() {
		closeModal();
	}
	return (
		<Modal
			header={`Preview a ${targetName[target]} PR`}
			contentLabel='This is a dialog window which overlays the main content of the
			page. The modal begins with a heading 2 called "Import
			Playground". Pressing the Close Import Window will close
			the modal and bring you back to where you were on the page.'
			onRequestClose={closeModal}
			isOpen
		>
			<PreviewPRForm
				playground={playground!}
				onClose={closeModal}
				onImported={handleImported}
				target={target}
			/>
		</Modal>
	);
}
