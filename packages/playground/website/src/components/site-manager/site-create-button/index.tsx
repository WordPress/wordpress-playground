import { Modal } from '@wordpress/components';
import { useState } from '@wordpress/element';
import SiteSettingsForm, { SiteFormData } from '../site-settings-form';
import { PlaygroundRoute, redirectTo } from '../../../lib/state/url/router';

export function SiteCreateButton({
	children,
}: {
	children: (onClick: () => void) => React.ReactNode;
}) {
	const [isModalOpen, setModalOpen] = useState(false);

	const addSite = async (data: SiteFormData) => {
		redirectTo(
			PlaygroundRoute.newTemporarySite({
				query: {
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
			})
		);
		setModalOpen(false);
	};

	return (
		<>
			{children(() => setModalOpen(true))}

			{isModalOpen && (
				<Modal
					title="Add a new site"
					onRequestClose={() => setModalOpen(false)}
				>
					<SiteSettingsForm
						onSubmit={addSite}
						onCancel={() => setModalOpen(false)}
						submitButtonText="Create a temporary site"
					/>
				</Modal>
			)}
		</>
	);
}
