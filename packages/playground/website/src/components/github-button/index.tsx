import { useState } from 'react';
import css from './style.module.css';
import Modal from '../modal';
import { usePlaygroundContext } from '../playground-viewport/context';
import GitHubForm from '../github-form';

export default function GitHubButton() {
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
	return (
		<>
			<button
				id="import-open-modal--btn"
				className={css.btn}
				aria-label="Import from GitHub"
				onClick={openModal}
			>
				GitHub
			</button>

			<Modal
				isOpen={isOpen}
				onRequestClose={closeModal}
			>
				<GitHubForm
					playground={playground!}
					onClose={closeModal}
					onImported={handleImported}
				/>
			</Modal>
		</>
	);
}
