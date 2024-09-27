import { Modal } from '@wordpress/components';
import { useMemo, useState } from 'react';
import { useAppSelector, useAppDispatch } from '../../../lib/state/redux/store';
import SiteSettingsForm, { SiteFormData } from '../site-settings-form';
import {
	selectSiteBySlug,
	updateSiteMetadata,
} from '../../../lib/state/redux/slice-sites';

export function SiteEditButton({
	siteSlug,
	children,
}: {
	siteSlug: string;
	children: (onClick: () => void) => React.ReactNode;
}) {
	const siteInfo = useAppSelector((state) =>
		selectSiteBySlug(state, siteSlug)
	)!;
	const [isModalOpen, setModalOpen] = useState(false);
	const dispatch = useAppDispatch();
	const updateSite = async (data: SiteFormData) => {
		await dispatch(
			updateSiteMetadata({
				slug: siteSlug,
				changes: {
					name: data.name,
					runtimeConfiguration: {
						...siteInfo.metadata.runtimeConfiguration,
						features: {
							...siteInfo.metadata.runtimeConfiguration.features,
							networking: data.withNetworking,
						},
						phpExtensionBundles: data.withExtensions
							? ['kitchen-sink']
							: ['light'],
						preferredVersions: {
							...siteInfo.metadata.runtimeConfiguration
								.preferredVersions,
							php: data.phpVersion,
						},
					},
				},
			})
		);
		// @TODO: Display a notification "site updated"
		setModalOpen(false);
	};

	const defaultValues = useMemo<Partial<SiteFormData>>(
		() => ({
			name: siteInfo.metadata.name,
			// @TODO: Handle an unsupported PHP version coming up here
			phpVersion: siteInfo.metadata.runtimeConfiguration.preferredVersions
				.php as any,
			withExtensions:
				siteInfo.metadata.runtimeConfiguration.phpExtensionBundles.includes(
					'kitchen-sink'
				),
			withNetworking:
				!!siteInfo.metadata.runtimeConfiguration.features.networking,
		}),
		[siteInfo]
	);

	return (
		<div>
			{children(() => setModalOpen(true))}

			{isModalOpen && (
				<Modal
					title="Edit Playground settings"
					onRequestClose={() => setModalOpen(false)}
				>
					<SiteSettingsForm
						onSubmit={updateSite}
						onCancel={() => setModalOpen(false)}
						submitButtonText="Update"
						formFields={{
							name: true,
							phpVersion: true,
							withExtensions: true,
							withNetworking: true,
						}}
						defaultValues={defaultValues}
					/>
				</Modal>
			)}
		</div>
	);
}
