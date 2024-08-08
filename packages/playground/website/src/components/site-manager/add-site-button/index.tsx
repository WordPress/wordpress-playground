import { Button, Modal, TextControl } from '@wordpress/components';
import css from './style.module.css';
import { useState } from '@wordpress/element';

export function AddSiteButton({
	onAddSite,
}: {
	onAddSite: (siteName: string) => void;
}) {
	const [isOpen, setOpen] = useState(false);
	const [siteName, setSiteName] = useState('');
	const openModal = () => setOpen(true);
	const closeModal = () => setOpen(false);
	const onAddSiteClick = () => {
		if (!siteName) {
			return;
		}
		onAddSite(siteName);
		closeModal();
	};

	return (
		<div className={css.addSiteButton}>
			<Button
				variant="primary"
				className={css.addSiteButtonComponent}
				onClick={openModal}
			>
				Add site
			</Button>

			{isOpen && (
				<Modal title="Add site" onRequestClose={closeModal}>
					<TextControl
						label="Site name"
						value={siteName}
						onChange={setSiteName}
					/>
					<Button variant="primary" onClick={onAddSiteClick}>
						Add site
					</Button>
				</Modal>
			)}
		</div>
	);
}
