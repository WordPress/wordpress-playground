import { Button } from '@wordpress/components';
import { Modal } from '../modal';
import { useAppDispatch, selectActiveSite } from '../../lib/state/redux/store';
import { setActiveModal } from '../../lib/state/redux/slice-ui';
import { useAppSelector } from '../../lib/state/redux/store';

export function MissingSiteModal() {
	const dispatch = useAppDispatch();
	const closeModal = () => dispatch(setActiveModal(null));

	const activeSite = useAppSelector((state) => selectActiveSite(state));

	if (!activeSite) {
		return null;
	}

	return (
		<Modal
			title="Site not found"
			contentLabel="This is a dialog window which indicates a site could not be found."
			isDismissible={true}
			shouldCloseOnClickOutside={true}
			onRequestClose={closeModal}
		>
			<p>
				The site <b>{activeSite.metadata.name}</b> could not be found.
			</p>
			<Button variant="primary" onClick={closeModal}>
				OK
			</Button>
		</Modal>
	);
}
