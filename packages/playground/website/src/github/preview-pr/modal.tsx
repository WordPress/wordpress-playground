import { Modal } from '../../components/modal';
import PreviewPRForm from './form';
import { setActiveModal } from '../../lib/state/redux/slice-ui';
import type { PlaygroundDispatch } from '../../lib/state/redux/store';
import { useDispatch } from 'react-redux';
import { __ } from '@wordpress/i18n';

interface PreviewPRModalProps {
	target: 'wordpress' | 'gutenberg';
}

export function PreviewPRModal({ target }: PreviewPRModalProps) {
	const dispatch: PlaygroundDispatch = useDispatch();
	const closeModal = () => {
		dispatch(setActiveModal(null));
	};
	const title =
		target === 'wordpress'
			? __('Preview a WordPress PR', 'playground-website')
			: __('Preview a Gutenberg PR or Branch', 'playground-website');
	return (
		<Modal small title={title} onRequestClose={closeModal}>
			<PreviewPRForm onClose={closeModal} target={target} />
		</Modal>
	);
}
