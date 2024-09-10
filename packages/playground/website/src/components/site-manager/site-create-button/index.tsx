import { Modal } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { useCurrentUrl } from '../../../lib/router-hooks';
import SiteSettingsForm, { SiteFormData } from '../site-settings-form';

export function SiteCreateButton({
	children,
}: {
	children: (onClick: () => void) => React.ReactNode;
}) {
	const [isModalOpen, setModalOpen] = useState(false);
	const [, setUrlComponents] = useCurrentUrl();

	const addSite = async (data: SiteFormData) => {
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
				language: data.language,
				multisite: data.multisite ? 'yes' : 'no',
			},
		});
		setModalOpen(false);
	};

	return (
		<>
			{children(() => setModalOpen(true))}

			{isModalOpen && (
				<Modal
					title="Add site"
					onRequestClose={() => setModalOpen(false)}
				>
					<SiteSettingsForm
						onSubmit={addSite}
						onCancel={() => setModalOpen(false)}
						submitButtonText="Create site"
					/>
				</Modal>
			)}
		</>
	);
}
