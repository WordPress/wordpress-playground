import { Button, Modal } from '@wordpress/components';
import css from './style.module.css';
import { useState } from '@wordpress/element';
import { useCurrentUrl } from '../../../lib/router-hooks';
import AddSiteForm, { AddSiteFormData } from '../add-site-form';

export function AddSiteButton() {
	const [isModalOpen, setModalOpen] = useState(false);
	const [, setUrlComponents] = useCurrentUrl();

	const addSite = async (data: AddSiteFormData) => {
		// @TODO: A single module to orchestrate these redirects.
		//        Right now we're duplicating the logic everywhere and changing
		//        these routes will be painful.
		setUrlComponents({
			searchParams: {
				php: data.phpVersion,
				wp: data.wpVersion,
				name: data.name,
				networking: data.withNetworking ? 'yes' : 'no',
				'php-extension-bundle': data.withExtensions
					? 'kitchen-sink'
					: 'light',
			},
		});
		setModalOpen(false);
	};

	return (
		<div className={css.addSiteButton}>
			<Button
				variant="primary"
				className={css.addSiteButtonComponent}
				onClick={() => setModalOpen(true)}
			>
				Add site
			</Button>

			{isModalOpen && (
				<Modal
					title="Add site"
					onRequestClose={() => setModalOpen(false)}
				>
					<AddSiteForm onSubmit={addSite} />
				</Modal>
			)}
		</div>
	);
}
